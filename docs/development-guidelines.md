# 開発ガイドライン (Development Guidelines)

## 前提環境

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v24.11.0 | CLAUDE.mdで指定 |
| TypeScript | 6.x | バージョン詳細は `docs/architecture.md`「依存関係管理 > バージョン管理方針」を参照 |
| pnpm | 10.x | Corepack 経由(`corepack enable`)。バージョンは `package.json` の `packageManager` で固定 |

開発環境は devcontainer での起動を前提とする（CLAUDE.md 参照）。

---

## コーディング規約

### TypeScript基本規約

**厳格な型付け**:
```typescript
// ✅ 明示的な型注釈
async function fetchImages(cursor?: string): Promise<LgtmImage[]> {
  // ...
}

// ❌ any型の使用禁止
async function fetchImages(cursor?: any): Promise<any[]> { }

// ✅ インターフェースでオブジェクト型を定義
interface CreateImageOptions {
  uploaderId: string;
  imageUrl: string;
}

// ✅ ユニオン型でリテラルを表現
type ImageStatus = 'processing' | 'active' | 'deleted';
```

**`as` キャストの禁止（原則）**:
```typescript
// ❌ 型を握りつぶすキャスト
const image = result as LgtmImage;

// ✅ 型ガードで安全に絞り込む
function isLgtmImage(value: unknown): value is LgtmImage {
  return typeof value === 'object' && value !== null && 'imageUrl' in value;
}
```

**例外として許容するケース**:

以下の場合のみ `as` を許容する。それ以外で利用する場合は PR レビューでコメントによる理由説明を必須とする。

1. **Supabase の型生成（`database.types.ts`）由来の型を狭める場合**
   ```typescript
   // ✅ Supabase が返す Json 型を、生成済み Row 型に絞り込む
   const profile = data as Database['public']['Tables']['user_profiles']['Row'];
   ```
2. **テストコード内でモック値を渡す場合**（プロダクションコードでは禁止）
3. **外部ライブラリの型定義不足を補う場合**（issue リンクをコメントに残すこと）

`any` への退避は禁止。代わりに `unknown` で受けて型ガードで絞り込むこと。

**`null` / `undefined` の扱い**:
```typescript
// ✅ Optional chaining + Nullish coalescing
const name = user?.displayName ?? '名無し';

// ✅ 早期リターンで型を絞り込む
if (!image) {
  throw new NotFoundError('LgtmImage', id);
}
// 以降は image が確定
```

---

### Next.js App Router 規約

**Server Component / Client Component の使い分け**:

```typescript
// ✅ デフォルトはServer Component
// app/(site)/page.tsx
export default async function ImageListPage() {
  const images = await imageService.listImages(); // 直接呼び出しOK
  return <ImageGrid images={images} />;
}

// ✅ ユーザーインタラクションが必要な場合のみ 'use client'
// components/copy-markdown-button.tsx
'use client';

import { useState } from 'react';

export function CopyMarkdownButton({ imageUrl }: { imageUrl: string }) {
  const [copied, setCopied] = useState(false);
  // ...
}
```

**一覧画面での関連エンティティ取得 (N+1 防止)**:

一覧 (例: `HomeContent` の画像グリッド) で各行に紐づくエンティティ (例: 投稿者プロフィール) を表示する場合、
**リクエスト内で `findManyByIds` を 1 回だけ呼ぶ**。`ImageCard` ごとに `findById` を呼んではならない。
取得結果は `Map<string, T>` に変換し、子コンポーネントには plain object として props で渡す。

```typescript
// ✅ components/home-content.tsx
const images = await getHomeImagesInitial();
const profiles = await buildUserProfileService(supabase).findManyByIds(
  images.map((i) => i.uploaderId),
);
const profileMap = new Map(profiles.map((p) => [p.id, p]));

return <ImageGrid images={images} profiles={profileMap} />;

// ❌ ImageCard 内で findById を呼ぶ (= N+1)
// async function ImageCard({ image }) {
//   const profile = await userProfileService.findById(image.uploaderId); // NG
// }
```

`findManyByIds` を提供するのは Service 層 (`UserProfileService.findManyByIds` 等)。
入力が空配列のときは Repository を呼ばないガードを Service / Repository の両層に置くこと
(契約と実装の二重防衛)。

**Route Handler のパターン**:

```typescript
// app/api/images/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { imageService } from '@/src/services/image-service';
import { z } from 'zod';

const createImageSchema = z.object({
  imageUrl: z.string().url().startsWith('https://').max(2048),
});

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createImageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '入力値が不正です' }, { status: 400 });
  }

  try {
    const image = await imageService.createImage(user.id, parsed.data.imageUrl);
    return NextResponse.json(image, { status: 201 });
  } catch (error) {
    if (error instanceof DuplicateImageError) {
      return NextResponse.json(
        { error: '同じ画像がすでに登録されています', existingImageId: error.existingImageId },
        { status: 409 }
      );
    }
    // 予期しないエラーは内部情報を隠す
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
```

**Server Action のパターン**:

Route Handler とは別に、フォーム送信から DB 更新 + `redirect()` で完結するフローでは Server Action を選ぶ。
外部からの POST 受け口や、細かいステータスコード制御が必要なら Route Handler を選ぶ。

```typescript
// src/lib/auth/actions.ts
'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';

// プロキシ経由（Vercel など）では origin ヘッダが落ちるので x-forwarded-* にフォールバック
function buildOrigin(headerList: Headers): string {
  const origin = headerList.get('origin');
  if (origin) return origin;

  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const host = headerList.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function signInWithGithub(): Promise<void> {
  const supabase = await createClient();
  const headerList = await headers();
  const origin = buildOrigin(headerList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/?auth_error=signin_failed');
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
```

呼び出し側は Server Component から `<form action={...}>` に直接渡す:

```tsx
// components/header.tsx
import { signInWithGithub, signOut } from '@/src/lib/auth/actions';

export function HeaderActions({ isLoggedIn }: { isLoggedIn: boolean }) {
  return isLoggedIn ? (
    <form action={signOut}>
      <button type="submit">ログアウト</button>
    </form>
  ) : (
    <form action={signInWithGithub}>
      <button type="submit">GitHub でログイン</button>
    </form>
  );
}
```

**Server Action 利用上の注意**:

- **`'use server'` は宣言必須**: ファイル先頭（または関数単位）で宣言する。これがないと普通のサーバ関数として扱われ、クライアントから呼べない
- **`redirect()` は throw する**: 内部で例外を投げて以降のコードを実行させない仕様。`try/catch` で握り潰さない。テストでは `next/navigation` を `vi.mock` で差し替え、`redirect(url)` 内で `__REDIRECT__:${url}` のような sentinel error を throw させると、`await expect(action()).rejects.toThrow('__REDIRECT__:/expected/path')` で呼び出し引数まで含めて検証できる（参考: `tests/unit/lib/auth/actions.test.ts`）
- **ユーザー入力由来の遷移先は必ずガードする**: `?next=...` など外部から渡された値を `redirect(value)` に直接渡すと open redirect になる。下記の `safeNext` のように相対パスのみ許可する

```typescript
// app/api/auth/callback/route.ts より抜粋
// `next` を相対パス (/ で始まり // で始まらない) に限定し、open redirect を封じる
function safeNext(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}
```

Server Action 内で `redirect(userProvidedPath)` する場合も、同等のガードを通すこと。

---

### エラーハンドリング規約

**エラークラスの管理方針**:

- すべてのドメインエラーは `src/lib/errors.ts` に集約する（`repository-structure.md` の `src/lib/` 直下に配置）
- 新しいエラーを追加する場合も同ファイルに追記し、エラークラスを別ファイルに分散させない
- API Layer / Service Layer では同ファイルからの import で参照する

```typescript
// ✅ 集約された一箇所から import
import { DuplicateImageError, DailyLimitExceededError } from '@/src/lib/errors';
```

**カスタムエラークラスの定義** (`src/lib/errors.ts`):

```typescript
export class AppError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} が見つかりません: ${id}`, 'NOT_FOUND');
  }
}

export class DuplicateImageError extends AppError {
  constructor(public readonly existingImageId: string) {
    super('同じ画像がすでに登録されています', 'DUPLICATE_IMAGE');
  }
}

export class DailyLimitExceededError extends AppError {
  constructor() {
    super('本日の登録上限（10枚）に達しました', 'DAILY_LIMIT_EXCEEDED');
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 'BAD_REQUEST');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(message, 'DATABASE_ERROR');
  }
}
```

**エラーは上位へ伝播させ、API Layerで変換する**:

```typescript
// ✅ Service: ビジネスエラーをthrow
class ImageService {
  async createImage(uploaderId: string, imageUrl: string): Promise<LgtmImage> {
    const count = await this.dailyCountRepo.getCount(uploaderId);
    if (count >= MAX_DAILY_UPLOADS) {
      throw new DailyLimitExceededError();
    }
    // ...
  }
}

// ✅ API Layer: エラーをHTTPレスポンスに変換
catch (error) {
  if (error instanceof DailyLimitExceededError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }
  // 予期しないエラーはログに記録し、詳細を隠す
  console.error('[POST /api/images]', error);
  return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
}
```

---

### 非同期処理

```typescript
// ✅ async/await を使用
async function compositeAndUpload(buffer: Buffer): Promise<string> {
  const composed = await composeLgtmImage(buffer);
  const { url } = await put(`lgtm/${crypto.randomUUID()}.webp`, composed, {
    access: 'public',
  });
  return url;
}

// ✅ 独立した処理は並列化
const [pHash, metadata] = await Promise.all([
  calculatePHash(buffer),
  sharp(buffer).metadata(),
]);
```

---

### コメント規約

CLAUDE.mdの方針に従い、コメントは最小限に留める。

```typescript
// ✅ WHYが非自明な場合のみコメントを書く

// redirect: 'error' でSSRF経由のリダイレクトを防止
const response = await fetch(url, { redirect: 'error' });

// pHash比較は全件走査。10万件超えたらpgvector移行を検討
const existing = await imageRepository.findAll();

// ❌ コードを読めばわかることは書かない
// 画像を取得する
const image = await imageRepository.findById(id);
```

---

### フォーマット規約

`biome.json` を正とする。Linter / Formatter は Biome 1 本に統一している（Prettier / ESLint からの移行は Issue #16 で実施済み）。

**Biome formatter 基本方針**(`biome.json` の `formatter` / `javascript.formatter`):

| 項目 | 値 | 理由 |
|------|-----|------|
| `formatter.indentStyle` | `'space'` | 既存コード(2 スペース) との互換性維持 |
| `formatter.indentWidth` | `2` | 既存コードと統一 |
| `formatter.lineWidth` | `100` | レビュー時の横スクロールを抑制 |
| `javascript.formatter.semicolons` | `'always'` | TypeScript で ASI 由来の事故を避ける |
| `javascript.formatter.quoteStyle` | `'single'` | TypeScript / React 標準的な慣習 |
| `javascript.formatter.trailingCommas` | `'all'` | git diff のノイズを最小化 |
| `javascript.formatter.arrowParentheses` | `'always'` | 引数追加時の差分を最小化 |

**Biome lint 基本方針**:

- `linter.rules.recommended: true` をベースに採用する
- 既存コードに合わせて以下のルールを調整している(`biome.json` 参照):
  - `style.noNonNullAssertion: "off"` — `process.env.X!` のような環境変数アクセスを許容
  - `tests/**` 配下は `suspicious.noThenProperty: "off"` — Supabase クエリビルダーモックの thenable を許容
- Next.js 固有の Web Vitals チェック(`next/core-web-vitals` 由来)は `next build` の警告と PR レビューで担保する
- 変更前に `pnpm run lint` をローカル実行する。自動修正可能なルールは `pnpm run check` で一括適用できる

CI で `pnpm run lint` を実行し、エラー検出時は失敗扱いとする。

**コミット時の自動実行 (lefthook)**:

`lefthook` 経由で `git commit` 時にステージ済みファイルへ Biome の lint/format を自動実行する。設定は `lefthook.yml` を参照する。

- `pnpm install` 直後に `prepare` スクリプト(`lefthook install`)が走り、`.git/hooks/pre-commit` がフレッシュリポジトリでは自動配置される
- 対象拡張子: `*.{js,jsx,ts,tsx,json,jsonc,css}`(Biome がサポートする拡張子のみ)
- 整形可能な差分は `biome check --write` により自動修正され、`stage_fixed: true` で再ステージされたうえでコミットに含まれる
- 修正不能な lint エラーが残った場合、コミットは失敗する(`biome.json` のルール設定は CI の `pnpm run lint` と同一。CI 側は format チェックを行わないため、format 違反は pre-commit の自動修正でのみ解消される)
- 上記対象外の拡張子のみのコミットでは、`biome-check` ジョブはスキップされコミットがそのまま成立する
- 緊急回避が必要な場合のみ `git commit --no-verify` でフックをバイパスできる。通常運用では使用しない

**既存フックとの競合**:

ローカルですでに `core.hooksPath` を独自設定している(例: `git secrets --install` を別経路で導入している)場合、`lefthook install` は安全のためデフォルトで失敗する。状況に応じて以下のいずれかで解消する:

```bash
# 既存の core.hooksPath を残し、その配下に lefthook を上書き配置する
# (既存の pre-commit は lefthook によって `pre-commit.old` にリネームされる。
#  必要であれば `lefthook.yml` の jobs として `.old` を再呼び出しするように移行する)
pnpm exec lefthook install --force

# あるいは、不要になった core.hooksPath 設定を解除して lefthook 標準の場所に置く
pnpm exec lefthook install --reset-hooks-path
```

`--force` を選んだ場合、保存された `pre-commit.old` を `lefthook.yml` の job として再呼び出しに移行することで既存ツール(git-secrets 等)との共存が可能。

---

### Supabase利用規約

**RLSを前提とした設計**:

```typescript
// ✅ サーバーサイド（Route Handler / Server Component）ではサービスロールを使わない
// 通常のsupbaseクライアント（anonキー）でRLSに委ねる
const supabase = createClient(); // src/lib/supabase/server.ts

// ✅ 管理者操作のみ service_role を使用（慎重に）
// サーバーサイドのみ、クライアントには絶対に渡さない
const adminClient = createAdminClient();
```

**型安全なクエリ**:

```typescript
// ✅ Supabaseの型生成を活用
import type { Database } from '@/src/types/database.types';

const { data, error } = await supabase
  .from('lgtm_images')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) throw new DatabaseError(error.message);
return data;
```

---

### Vercel Preview 環境での認証設定

#### 症状

Vercel Preview 環境（例: `https://lgtmhub-git-<branch>-kakikubos-projects.vercel.app/`）でログインボタンを押すと、認証フロー完了後に本番ドメインに着地してしまい、Preview のログイン状態を確認できない。

#### 原因

Supabase Auth は `signInWithOAuth` に渡された `redirectTo` を以下の規則で解決する:

1. `redirectTo` が **Site URL** または **Additional Redirect URLs** のパターンにマッチする → そこへ戻す
2. いずれにもマッチしない → **Site URL にフォールバック**する

Preview のサブドメインは PR ごとに動的に変わるため、Additional Redirect URLs にワイルドカードで登録しておかないとフォールバックして本番（= Site URL）に流れる。

#### Supabase Dashboard 設定

Auth > URL Configuration の **Additional Redirect URLs** に以下を追加する:

```
https://lgtmhub-git-*-kakikubos-projects.vercel.app/**
```

個別デプロイ URL（`lgtmhub-<hash>-kakikubos-projects.vercel.app`）も使う場合は、合わせて以下も登録する:

```
https://lgtmhub-*-kakikubos-projects.vercel.app/**
```

- `*` は単一サブドメインセグメント、`**` は複数セグメント（パス含む）にマッチする
- **Site URL は本番ドメインのまま変更しない**（変更すると本番のフォールバックが Preview 側に流れて事故になる）

#### GitHub OAuth App 側

GitHub OAuth App の Authorization callback URL は Supabase の固定 URL（`https://<project-ref>.supabase.co/auth/v1/callback`）を維持する。Preview ごとに変える必要はなく、Supabase が `redirectTo` への最終遷移を担う。

#### アプリ側の origin 解決

`src/lib/auth/actions.ts` の `buildOrigin` が、`Origin` ヘッダ → `x-forwarded-proto` / `host` の順に Preview の origin を動的算出する。Server Action は POST のため `Origin` が付き、Vercel が `x-forwarded-*` を付与するため Preview 環境でも正しい `redirectTo` が組み立てられる。**コード側の追加対応は不要**で、Supabase 側に Preview ワイルドカードが登録されていれば動作する。

### 本番 DB / Preview DB の分離構成

Issue #20 で、Vercel の Production / Preview デプロイが参照する Supabase プロジェクトを分離した。

| | Supabase プロジェクト | Vercel env スコープ |
|---|---|---|
| 本番 | `lgtm2`(`qbkoalhilwtjydpscrye`, 東京) | Production |
| Preview | `lgtmhub-preview`(東京) | Preview |

- アプリは `NEXT_PUBLIC_SUPABASE_URL` 等をランタイム参照するだけで、参照先 DB は **Vercel 環境変数のスコープ分け**で決まる(コード変更不要)
- Vercel の Preview スコープには **Preview プロジェクトの値のみ**を設定する。本番の `SUPABASE_SERVICE_ROLE_KEY` を Preview に絶対入れない(事故防止)
- migrations / config.toml は `supabase-deploy.yml` が main マージ時に prod・preview 両方へ自動 push する(`config.toml` の `[remotes.prod]` / `[remotes.preview]` が project_id 一致で適用)
- Preview プロジェクトは **独自の GitHub OAuth App** と **独自の URL Configuration** を持つ。上記ワイルドカードは Preview プロジェクト側の Additional Redirect URLs に登録し、Site URL も Preview ドメインにする(本番プロジェクトの設定とは独立)
- 本番 → Preview のデータ初期コピーは一度きりのスナップショット。`auth.users` 含むフルコピーで、リストア時は `set session_replication_role = replica` で `handle_new_user` トリガを無効化する(二重 insert 回避)
- 作業手順の詳細は `.steering/20260623-split-preview-db/` を参照

---

## Git運用ルール

### ブランチ戦略

```
main（本番環境）
├── feature/{機能名}  → 新機能開発
├── fix/{修正名}      → バグ修正
└── docs/{ドキュメント名} → ドキュメント更新
```

- `main` へは直接コミットしない。必ずPRを経由する
- PRはセルフレビュー後に作成する（個人開発のためレビュアーは任意）
- マージ後は速やかにブランチを削除する

### コミットメッセージ規約

グローバル設定（`~/.claude/rules/commit-style.md`）に従う。

```
<1行目: 日本語で変更内容を簡潔に>

- <変更点1>
- <変更点2>
- <変更点3>
```

**例**:

```
画像登録APIを実装

- POST /api/images のRoute Handlerを作成
- pHashによる重複チェックを追加
- 1日10枚の登録制限をDailyUploadCountRepositoryで管理
```

```
LGTM文字合成ロジックを実装

- Sharp SVGオーバーレイで白文字+黒縁のLGTM文字を合成
- WebP変換と長辺 400px へのリサイズ（元アスペクト比保持）を実施
- 合成後の画像バッファをunit testで検証
```

**注意**:
- `Co-Authored-By` 行は含めない（グローバル設定）
- コミットは作業の最小単位ごとに行う
- 1コミットで複数の関心事を混ぜない

### PRの原則

グローバル設定（`~/.claude/rules/pr-principle.md`）に従う。

**1PR = 1つの関心事**。「このPRは何をするPRか？」を一言で説明できること。

```
✅ 良いPR例
- 「画像登録APIを実装」
- 「お気に入り追加・解除機能を実装」
- 「pHash重複チェックのユニットテストを追加」

❌ 混在している例
- 「画像登録APIと管理者削除機能とお気に入りを実装」
  → 3つの機能を分割すること
```

**PRの大きさの目安**:
- 変更ファイル数: 10ファイル以内を推奨
- 変更行数: 500行以内（500行を超えると Danger が CI を失敗させる）

**計測対象**:
- プロダクションコード（`app/`、`src/`、`components/`）の追加・変更行数で判定する
- 以下は計測対象に含めない:
  - テストコード（`tests/`）
  - 自動生成ファイル（`src/types/database.types.ts` など）
  - lockfile（`pnpm-lock.yaml`）
  - マイグレーションSQL（`supabase/migrations/`）
  - markdown ファイル（`*.md` / `*.mdx`）

確認方法:

```bash
# プロダクションコード変更行数の確認例（あくまで目安。正確な集計は dangerfile.ts に従う）
# tests/ ・ pnpm-lock.yaml ・ supabase/migrations/ は対象パス指定で既に除外される
git diff --stat main...HEAD -- 'app/' 'src/' 'components/' \
  ':(exclude)src/types/database.types.ts' \
  ':(exclude)*.md' ':(exclude)*.mdx'
```

500行を超える場合は関心事ごとに分割する。

**自動チェック（Danger）**:

PR の作成・更新時に GitHub Actions（`.github/workflows/danger.yml`）が `dangerfile.ts` を実行し、行数閾値を超過した場合に Danger ジョブを**失敗（CI エラー）**させる。

- 行数閾値（500行）を超えた場合は `fail()` となり、`pnpm exec danger ci --failOnErrors` により Danger ジョブが赤くなる（ブロッキング）
- ファイル数閾値（10ファイル）超過は `warn()`（コメント警告のみ、ブロックしない）
- 計測対象・除外ルール（markdown 除外を含む）は `dangerfile.ts` の `INCLUDE_PREFIXES` / `EXCLUDE_PATTERNS` に集約し、本ドキュメントと同期する

---

## テスト戦略

### テストピラミッド

```
     /E2E\      少（Playwright、ブラウザ起動）
    /------\
   /  統合  \   中（Vitest + Supabase Local）
  /----------\
 / ユニット   \  多（Vitest、高速）
/--------------\
```

**比率目標**: ユニット 70% / 統合 20% / E2E 10%

### ユニットテスト (Vitest)

**対象**: `src/lib/` と `src/services/` のビジネスロジック

```typescript
// tests/unit/lib/image/calculate-phash.test.ts
import { describe, it, expect } from 'vitest';
import { calculatePHash, hammingDistance } from '@/src/lib/image/calculate-phash';

describe('calculatePHash', () => {
  it('同じ画像から同じpHashが生成される', async () => {
    const buffer = await readTestImage('sample.jpg');
    const hash1 = await calculatePHash(buffer);
    const hash2 = await calculatePHash(buffer);
    expect(hash1).toBe(hash2);
  });

  it('異なる画像では十分に異なるpHashが生成される', async () => {
    const buffer1 = await readTestImage('cat.jpg');
    const buffer2 = await readTestImage('dog.jpg');
    const hash1 = await calculatePHash(buffer1);
    const hash2 = await calculatePHash(buffer2);
    expect(hammingDistance(hash1, hash2)).toBeGreaterThan(10);
  });
});
```

**Given-When-Then パターン**を使用:

```typescript
describe('ImageService.createImage', () => {
  it('1日の登録上限を超えた場合DailyLimitExceededErrorをthrowする', async () => {
    // Given
    const mockCountRepo = { getCount: vi.fn().mockResolvedValue(10), increment: vi.fn() };
    const service = new ImageService(mockImageRepo, mockCountRepo, mockBlobClient);

    // When/Then
    await expect(
      service.createImage('user-id', 'https://example.com/image.jpg')
    ).rejects.toThrow(DailyLimitExceededError);
  });
});
```

**カバレッジ目標**:
```typescript
// vitest.config.ts — 閾値は CI を含め常時ゲート
coverage: {
  thresholds: {
    'src/services/**': { branches: 90, functions: 85, lines: 90, statements: 90 },
    'src/lib/**': { branches: 80, functions: 75, lines: 80, statements: 80 },
  }
}
```

この `thresholds` は **CI を含め常に有効なゲート**（ローカル / devcontainer / CI のいずれでも `pnpm run test:coverage` で適用）。v8 の `functions` 計測は Node のマイナーバージョン差で約 12〜13pt 下振れする（ローカル `src/services/**` 100% / `src/lib/**` 90.9% に対し CI(ubuntu/Node 24.x) では 88.23% / 77.5%）ため、`functions` のみ CI 実測フロアの下にバッファを取った値（services 85 / lib 75）へ引き下げて env 差を吸収している。`branches`/`lines`/`statements` は v8-to-istanbul でソースレンジにマップされ安定し CI 実測でも 90/80 を通過するため据え置く。閾値未達は `vitest` が非 0 終了するため `test` ジョブのゲートとなる。Codecov は別途**可視化**（PR コメント・時系列・バッジ）に用いる。採用アプローチと却下理由は Issue #113 / `.steering/20260517-coverage-threshold-ci-gate/` を参照。詳細は「CI/CDパイプライン > Codecov」も参照。

### 統合テスト (Vitest + Supabase Local)

**対象**: API Routeの正常系・異常系、RLSポリシーの検証

```typescript
// tests/integration/images/image-crud.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createTestClient, createAdminClient } from '../helpers/supabase';

describe('POST /api/images', () => {
  it('ログイン済みユーザーが画像を登録できる', async () => {
    const res = await fetch('/api/images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ imageUrl: 'https://example.com/test.jpg' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.imageUrl).toMatch(/^https:\/\//);
  });

  it('未ログインでは401が返る', async () => {
    const res = await fetch('/api/images', {
      method: 'POST',
      body: JSON.stringify({ imageUrl: 'https://example.com/test.jpg' }),
    });
    expect(res.status).toBe(401);
  });
});
```

### E2Eテスト (Playwright)

**対象**: ユーザーが実際に行う主要フロー

```typescript
// tests/e2e/image-list.test.ts
import { test, expect } from '@playwright/test';

test('未ログインユーザーが画像一覧を閲覧しマークダウンをコピーできる', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-testid="image-grid"]')).toBeVisible();

  // マークダウンコピーボタンをクリック
  await page.locator('[data-testid="copy-markdown-button"]').first().click();
  await expect(page.locator('[data-testid="copy-feedback"]')).toContainText('コピーしました');
});
```

#### ログイン済みフローの E2E (storageState パターン)

GitHub OAuth 全体を E2E に含めるのは外部 IDP に依存して不安定なため、本リポジトリでは「ログイン済み状態の cookie を `storageState` として持ち回る」方針を採用しています。

仕組み:

1. `tests/e2e/global-setup.ts` が Supabase Admin API でテストユーザーを idempotent に作り直す
2. 同 globalSetup から `/api/auth/test-signin` (E2E 限定エンドポイント) を呼び、`@supabase/ssr` 互換の session cookie を確立する
3. `tests/e2e/.auth/authenticated-user.json` に `storageState` を保存する
4. `playwright.config.ts` の `authenticated` プロジェクトがその `storageState` を読み込んで実行する

ログイン済み前提のテストは `tests/e2e/auth-callback.test.ts` のように **専用ファイル** として書き、`testMatch` で `authenticated` プロジェクトに振り分けます。未ログインのテストはデフォルトの `chromium` プロジェクトで動かすため、ファイル単位で「どちらの状態を前提とするか」が一目で分かります。

**新しい認証済み E2E を書くときの手順**:

1. `tests/e2e/<feature>-authenticated.test.ts` のように、認証済み専用と分かるファイル名にする
2. `playwright.config.ts` の `chromium` プロジェクトの `testIgnore` と `authenticated` プロジェクトの `testMatch` の両方に正規表現を追加する
3. テスト本体は通常の `test('...', async ({ page }) => { ... })` で書ける (storageState はプロジェクト設定で適用済み)

**注意**:

- `/api/auth/test-signin` は `process.env.E2E_TEST_MODE === 'true'` のときのみ動く。本番では未設定にする (Vercel/CI の本番デプロイ環境変数に絶対に追加しないこと)
- `tests/e2e/.auth/` は `.gitignore` 済み。CI では globalSetup が毎回再生成する
- ローカル実行には `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` と `E2E_TEST_MODE=true` を追加する必要がある (詳しくは README 参照)

---

## CI/CDパイプライン

### GitHub Actions

> 以下は構成を説明するためのサンプル。`actions/*` などのバージョンは `renovate.json` の `github-actions` グループで自動更新されるため、**常に実際の `.github/workflows/ci.yml` を正**とする（サンプルのバージョン表記をそのままコピーしない）。

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck

  test:
    runs-on: ubuntu-latest
    # 設計意図: CI 上では Supabase CLI（Docker）の起動コストを避け、
    # 統合テストの DB 接続先として素の Postgres コンテナを使用する。
    # RLS ポリシーの検証はローカル開発時の `pnpm run db:start`（Supabase Local）で行い、
    # CI ではテーブル制約・トランザクション・SQL 互換性のみを検証する方針。
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      # test:unit / test:integration の 2 回実行をやめ、test:coverage
      # (= vitest run --coverage) の 1 パスに統合。include/exclude により
      # unit + integration をまとめて実行し (e2e は対象外)、カバレッジを計測する。
      # カバレッジ閾値は vitest.config.ts で CI を含め常時ゲート。v8 の function
      # 計測の Node マイナー差は functions 閾値を CI 実測ベースに調整して吸収済み。
      # 閾値未達・テスト失敗いずれも vitest が非 0 終了し test ジョブのゲートとなる。
      - run: pnpm run test:coverage
      # カバレッジを Codecov にアップロードして PR / main で可視化する。
      # public リポジトリのため CODECOV_TOKEN 未設定でも tokenless で動作し、
      # アップロード可否を CI のゲートにしない (fail_ci_if_error: false)。
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v5
        with:
          token: ${{ secrets.CODECOV_TOKEN }}
          files: ./coverage/lcov.info
          fail_ci_if_error: false

  e2e:
    runs-on: ubuntu-latest
    # 設計意図: e2e ジョブは supabase/setup-cli + supabase start で本物の
    # PostgreSQL + PostgREST + Auth + Storage を Docker で立ち上げ、Server Component
    # / Route Handler が実 DB を叩けるようにする。NEXT_PUBLIC_* は build 時に
    # インライン化されるため、必ず `pnpm run build` の前に `$GITHUB_ENV` 経由で注入する。
    env:
      GITHUB_OAUTH_CLIENT_ID: ''
      GITHUB_OAUTH_CLIENT_SECRET: ''
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - uses: supabase/setup-cli@v1
        with:
          version: 2.98.0
      - run: supabase start
      - name: Export Supabase env to GITHUB_ENV
        run: |
          set -euo pipefail
          status=$(supabase status -o json)
          echo "NEXT_PUBLIC_SUPABASE_URL=$(echo "$status" | jq -er '.API_URL')" >> "$GITHUB_ENV"
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$status" | jq -er '.ANON_KEY')" >> "$GITHUB_ENV"
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm run build
      - run: pnpm run test:e2e
      - if: always()
        run: supabase stop --no-backup

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm audit --audit-level high
```

#### Danger（PR サイズチェック）

`.github/workflows/danger.yml` で `pull_request` イベントごとに `pnpm exec danger ci --failOnErrors` を実行する。判定ロジックは `dangerfile.ts` に集約しており、「PRの大きさの目安」セクションの行数閾値（500行）を超過した場合は `fail()` となり、`--failOnErrors` により Danger ジョブが失敗（CI エラー）する。ファイル数閾値（10ファイル）超過は `warn()`（コメント警告のみ）。markdown ファイル（`*.md` / `*.mdx`）は集計対象外。既存 `ci.yml` とは独立した workflow とし、API 書き込みの副作用が他ジョブに波及しないようにしている。

#### Codecov（カバレッジ可視化）

`ci.yml` の `test` ジョブで `pnpm run test:coverage` を実行し、生成された `coverage/lcov.info` を `codecov/codecov-action@v5` で Codecov にアップロードする。`test` ジョブは `push: [main]` と `pull_request` 両方で走るため、**PR と main マージ後の双方**でカバレッジが Codecov に記録され、PR には差分コメントが付く。README のカバレッジバッジも Codecov を参照する。

- **可視化が責務（ゲートは vitest 側）**: カバレッジ閾値は `vitest.config.ts` の `thresholds` で **CI を含め常時ゲート**（`src/services/**` は branches/lines/statements 90% ・ functions 85%、`src/lib/**` は branches/lines/statements 80% ・ functions 75%）。v8 の `functions` 計測は Node のマイナーバージョン差で約 12〜13pt 下振れするため、`functions` のみ CI 実測フロア（services 88.23% / lib 77.5%）の下にバッファを取った値へ引き下げて env 差を吸収している（採用アプローチと却下案は Issue #113 を参照。Node patch 固定／functions 除外／istanbul 化は却下し、CI 実測ベースの閾値調整を採用）。Codecov は閾値ゲートを持たず可視化に専念し、`codecov.yml` の project / patch ステータスも `informational: true`（二重ゲートにしない）。なお**閾値未達・テスト失敗いずれも `vitest` が非 0 終了するため、`test` ジョブのゲートとして機能する**。
- **token は任意**: public リポジトリのため `CODECOV_TOKEN` 未設定でも tokenless でアップロードできる。レート制限回避のため設定する場合は GitHub Secrets に `CODECOV_TOKEN` を登録する。アップロード失敗で `test` ジョブを落とさないよう `fail_ci_if_error: false`。
- **集計対象**: `codecov.yml` の `ignore` を `vitest.config.ts` の `coverage.exclude`（`src/types/**` / `*.test.ts`）と整合させている。
- **バージョン管理**: `codecov/codecov-action` は `renovate.json` の `github-actions` グループで自動更新対象（固定運用ではない）。
- **初回の手動セットアップ（リポジトリ管理者作業）**: Codecov (codecov.io) に GitHub アカウントでサインインし `kakikubo/lgtmhub` を有効化する。これにより PR コメントとダッシュボードが有効になる。必要に応じて `CODECOV_TOKEN` を GitHub Secrets に登録する。

#### Supabase Migrations Auto Deploy

`.github/workflows/supabase-deploy.yml` で main マージ時に `supabase/migrations/**` の差分をリモート Supabase (`lgtm2`) に自動 push する。

- トリガー: `push: branches: [main]` + `paths: ['supabase/migrations/**']`、および `workflow_dispatch`（手動再実行用）
- 必要な GitHub Secrets:
  - `SUPABASE_ACCESS_TOKEN`: Supabase アカウント個人アクセストークン (CLI 認証)
  - `SUPABASE_DB_PASSWORD`: リモート DB 接続パスワード
  - `SUPABASE_PROJECT_REF`: リンク先プロジェクト ref (`qbkoalhilwtjydpscrye`)
- `concurrency: { group: supabase-db-push, cancel-in-progress: false }` で直列化（部分適用防止のため実行中を殺さず queue する）
- `permissions: contents: read` のみ。フォーク PR からの secrets 露出を避けるため `pull_request` トリガーは持たない
- 失敗時の手動リカバリ: ローカルから `pnpm exec supabase db push --linked`

### package.json scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "biome lint .",
    "format": "biome format --write .",
    "check": "biome check .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:coverage": "vitest run --coverage",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:nuke": "supabase stop --no-backup",
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

---

## 依存関係管理 (Renovate)

依存関係（依存パッケージ / GitHub Actions / devcontainer の base image）は [Renovate](https://docs.renovatebot.com/) で自動更新する。設定はリポジトリルートの `renovate.json` を正とし、変更は通常の PR フローで行う。

### スケジュールと自動マージ方針

| 種別 | 例 | 自動マージ | 備考 |
|------|------|-----------|------|
| minor / patch | `next 15.5.15 → 15.5.16` | ✅ (CI green 時) | `platformAutomerge` で GitHub の auto-merge を利用 |
| GitHub Actions の更新 | `actions/checkout@v4 → v5` | ✅ (CI green 時) | `github-actions` グループにまとめる |
| `lockFileMaintenance` | `pnpm-lock.yaml` の週次更新 | ✅ | 月曜午前 |
| major | `react 19 → 20` | ❌ (手動レビュー) | `dependencies` / `major` ラベル付き |
| vulnerability alerts | GitHub Security Advisory 由来 | ❌ (手動レビュー) | スケジュールを無視して即時 PR |
| `engines.node` | Node のメジャー更新 | 無効化 | devcontainer / `actions/setup-node` / `engines.node` を手動で同期 |

PR は **月曜の朝（Asia/Tokyo 9 時前）** にまとめて立ち、`chore(deps): ...` の Conventional Commit スタイルとなる。Dependency Dashboard issue がリポジトリに常時 1 件存在し、保留中の更新と open PR が一覧できる。

### グルーピング方針

`packageRules` で以下のグループにまとめている。詳細は `renovate.json` を参照。

| グループ | 対象 | 理由 |
|---------|------|------|
| `react` | `react`, `react-dom`, `@types/react*` | 本体と型定義を分けると型エラーになる |
| `next` | `next`, `@next/*`, `eslint-config-next` (将来) | メジャー間で破壊的変更が出やすい |
| `supabase` | `@supabase/*`, `supabase` (CLI) | クライアント / SSR / CLI の整合性 |
| `biome` | `@biomejs/*` | フォーマッタとプラグイン |
| `vitest` | `vitest`, `@vitest/*`, `vite-tsconfig-paths` | Vitest コアとプラグイン |
| `playwright` | `@playwright/*` | Playwright モジュール群 |
| `tailwind` | `tailwindcss`, `@tailwindcss/*`, `tw-animate-css` | Tailwind v4 と PostCSS プラグイン |
| `types` | 上記以外の `@types/*` | 型定義のみのまとめ |
| `github-actions` | `.github/workflows/*.yml` の actions | digest 更新を含む / CI green 時に自動マージ |
| `devcontainer` (default manager) | `.devcontainer/devcontainer.json` の base image | グループ化はせず単独 PR・**手動レビュー** (Node.js メジャーと一緒に揃えるため) |

### 初回セットアップ手順 (リポジトリ管理者向け)

`renovate.json` のコミットだけでは Renovate は動かない。GitHub App 側の有効化が必要。

1. [Mend Renovate App](https://github.com/apps/renovate) を `kakikubo/lgtmhub` にインストール
2. リポジトリ Settings > General > Pull Requests で **Allow auto-merge** を有効化（`automerge: true` の前提）
3. 初回 Onboarding PR が立つので、`renovate.json` の内容に変更がなければそのままマージ
4. Dependency Dashboard issue が作成されたことを確認

`renovate.json` の妥当性は以下のコマンドでローカル検証できる:

```bash
pnpm --package=renovate dlx renovate-config-validator renovate.json
```

### major / vulnerability の運用

- Dependency Dashboard issue を週 1 確認し、major アップデートはチェックボックスで個別にトリガー
- vulnerability alerts は Slack / GitHub 通知が来たら **その日のうちに** レビュー & マージする
- メジャー更新で破壊的変更が含まれる場合は、追従 PR とは別ブランチでアプリ側の修正を入れてから merge する

### `engines.node` を Renovate で更新しない理由

Node.js のメジャーは、`package.json` の `engines.node`、`actions/setup-node` の `node-version`、`.devcontainer/devcontainer.json` の base image (`mcr.microsoft.com/devcontainers/typescript-node:1-24`) を **同時に** 整合させる必要がある。Renovate は manager 単位で別 PR を作るため、ここだけ手動運用にしている (`renovate.json` の `matchDepTypes: ["engines"], matchDepNames: ["node"], enabled: false`)。

---

## 開発環境セットアップ

### 初回セットアップ

```bash
# 1. 依存パッケージのインストール
pnpm install

# 2. 環境変数の設定
cp .env.example .env.local
# .env.local を編集（Supabase / Vercel Blob / GitHub OAuth の設定を記入）

# 3. Supabase Localの起動
pnpm run db:start

# 4. マイグレーションの適用
pnpm run db:reset

# 5. 型定義の生成
pnpm run db:types

# 6. 開発サーバーの起動
pnpm run dev
```

### 日常的な開発コマンド

```bash
# 型エラーをウォッチ（別ターミナルで起動）
pnpm run typecheck -- --watch

# Vitest ウォッチモード（保存時に対象テストのみ再実行）
pnpm run test -- --watch

# Playwright UI モード（E2Eテストをブラウザで対話的に実行）
pnpm exec playwright test --ui

# Supabase スキーマ差分の確認（マイグレーション作成前）
supabase db diff

# Supabase Local の起動状態を確認
supabase status

# DBの初期化（マイグレーションを最初から再適用）
pnpm run db:reset

# 型定義の再生成（マイグレーション変更後に必須）
pnpm run db:types
```

開発フロー上の用途:

| シーン | 推奨コマンド |
|--------|-------------|
| ロジック修正中 | `pnpm run test -- --watch` で対象テストを常時実行 |
| API実装中 | `pnpm run dev` + `pnpm run typecheck -- --watch` を別ターミナルで併用 |
| E2Eシナリオ検証 | `pnpm exec playwright test --ui` でステップを目視確認 |
| マイグレーション追加後 | `pnpm run db:reset` → `pnpm run db:types` → 型エラー解消 |

### 環境変数一覧

`.env.example` に全変数のテンプレートを配置する。

| 変数名 | 用途 | 公開範囲 |
|--------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | SupabaseプロジェクトURL | クライアント公開 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase匿名キー | クライアント公開 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseサービスロール | **サーバーサイドのみ** |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob書き込みトークン | **サーバーサイドのみ** |
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth アプリの Client ID（Supabase Auth 経由で利用） | **サーバーサイドのみ** |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth アプリの Client Secret（Supabase Auth 経由で利用） | **サーバーサイドのみ** |

**`NEXT_PUBLIC_` プレフィックスなしの変数はクライアントに絶対に渡さない。**

---

## コードレビュー

### セルフレビューチェックリスト

PRを作成する前に以下を確認する:

**コード品質**:
- [ ] 命名が明確で一貫しているか
- [ ] 関数が単一の責務を持っているか（20行以内を目安）
- [ ] マジックナンバーが定数に置き換えられているか
- [ ] エラーハンドリングが適切に実装されているか

**セキュリティ**:
- [ ] 入力値をzodでバリデーションしているか
- [ ] 機密情報がコードにハードコードされていないか
- [ ] 認証チェックが API Layer で実施されているか
- [ ] 他ユーザーのリソースにアクセスできないか（RLS / サービス層の権限チェック）

**テスト**:
- [ ] ビジネスロジックにユニットテストが追加されているか
- [ ] 新規APIエンドポイントに統合テストが追加されているか
- [ ] `pnpm run test` がパスするか
- [ ] `pnpm run typecheck` がパスするか
- [ ] `pnpm run lint` がパスするか

**ドキュメント**:
- [ ] WHYが非自明な箇所にコメントがあるか
- [ ] 新しいAPIエンドポイントが `docs/functional-design.md` の設計と一致しているか

---

## 実装チェックリスト

### 新機能実装時

1. `docs/functional-design.md` の対応するAPI仕様を確認
2. `docs/repository-structure.md` を参照してファイル配置を決定
3. テストファイルを先に作成（Given-When-Thenを書く）
4. 実装してテストを通す
5. セルフレビューチェックリストを確認
6. PRを作成

### マイグレーション追加時

1. `supabase db diff` で差分を確認してからマイグレーションファイルを作成
2. ローカルで `pnpm run db:reset` して正常適用を確認
3. RLSポリシーを必ず設定する
   - SELECT ポリシーが状態カラム (例: `lgtm_images.status`) に依存する場合、UPDATE で状態遷移する経路を必ず洗い出す
   - 新状態が SELECT ポリシーの `USING` を満たさないと PostgreSQL の post-update visibility check で `new row violates row-level security policy` が発生する。所有者・管理者用の追加 SELECT ポリシーで救うのが定石（`supabase/migrations/20260506000000_extend_lgtm_images_select_policy.sql` を参照）
4. `pnpm run db:types` で型定義を再生成してコミットに含める
5. PR をマージするとリモート Supabase には `.github/workflows/supabase-deploy.yml` が自動で反映する。失敗時は Actions ログを確認し、ローカルから `pnpm exec supabase db push --linked` で手動リカバリ
