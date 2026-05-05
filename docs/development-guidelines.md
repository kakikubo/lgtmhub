# 開発ガイドライン (Development Guidelines)

## 前提環境

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v24.11.0 | CLAUDE.mdで指定 |
| TypeScript | 6.x | バージョン詳細は `docs/architecture.md`「依存関係管理 > バージョン管理方針」を参照 |
| npm | 11.x | Node.js v24に同梱 |

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
- 変更前に `npm run lint` をローカル実行する。自動修正可能なルールは `npm run check` で一括適用できる

CI で `npm run lint` を実行し、エラー検出時は失敗扱いとする。

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
- WebP変換と幅1200px以内のリサイズを実施
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
- 変更行数: 300行以内を推奨

**計測対象**:
- プロダクションコード（`app/`、`src/`、`components/`）の追加・変更行数で判定する
- 以下は計測対象に含めない:
  - テストコード（`tests/`）
  - 自動生成ファイル（`src/types/database.types.ts` など）
  - lockfile（`package-lock.json`）
  - マイグレーションSQL（`supabase/migrations/`）

確認方法:

```bash
# プロダクションコード変更行数の確認例
git diff --stat main...HEAD -- 'app/' 'src/' 'components/' \
  ':(exclude)src/types/database.types.ts'
```

300行を超える場合は分割を検討する。例外を認める場合はPR説明欄に理由を記載する。

**自動チェック（Danger）**:

PR の作成・更新時に GitHub Actions（`.github/workflows/danger.yml`）が `dangerfile.ts` を実行し、上記閾値を超過した場合に PR コメントで warning を出す。

- 行数閾値（300行）または ファイル数閾値（10ファイル）を超えた場合のみコメントが付く
- ブロックではなく warning なので、例外運用（PR 説明欄に理由を記載してマージ）はそのまま継続できる
- 計測対象・除外ルールは `dangerfile.ts` の `INCLUDE_PREFIXES` / `EXCLUDE_PATTERNS` に集約し、本ドキュメントと同期する

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
// vitest.config.ts
coverage: {
  thresholds: {
    'src/services/**': { branches: 90, functions: 90, lines: 90 },
    'src/lib/**': { branches: 80, functions: 80, lines: 80 },
  }
}
```

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
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck

  test:
    runs-on: ubuntu-latest
    # 設計意図: CI 上では Supabase CLI（Docker）の起動コストを避け、
    # 統合テストの DB 接続先として素の Postgres コンテナを使用する。
    # RLS ポリシーの検証はローカル開発時の `npm run db:start`（Supabase Local）で行い、
    # CI ではテーブル制約・トランザクション・SQL 互換性のみを検証する方針。
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm run test:unit
      - run: npm run test:integration

  e2e:
    runs-on: ubuntu-latest
    # 設計意図: e2e ジョブは supabase/setup-cli + supabase start で本物の
    # PostgreSQL + PostgREST + Auth + Storage を Docker で立ち上げ、Server Component
    # / Route Handler が実 DB を叩けるようにする。NEXT_PUBLIC_* は build 時に
    # インライン化されるため、必ず `npm run build` の前に `$GITHUB_ENV` 経由で注入する。
    env:
      GITHUB_OAUTH_CLIENT_ID: ''
      GITHUB_OAUTH_CLIENT_SECRET: ''
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
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
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:e2e
      - if: always()
        run: supabase stop --no-backup

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm audit --audit-level=high
```

#### Danger（PR サイズ警告）

`.github/workflows/danger.yml` で `pull_request` イベントごとに `npx danger ci` を実行する。判定ロジックは `dangerfile.ts` に集約しており、「PRの大きさの目安」セクションの閾値超過時に PR コメントで warning を出す。既存 `ci.yml` とは独立した workflow とし、API 書き込みの副作用が他ジョブに波及しないようにしている。

### npm scripts

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
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

---

## 開発環境セットアップ

### 初回セットアップ

```bash
# 1. 依存パッケージのインストール
npm install

# 2. 環境変数の設定
cp .env.example .env.local
# .env.local を編集（Supabase / Vercel Blob / GitHub OAuth の設定を記入）

# 3. Supabase Localの起動
npm run db:start

# 4. マイグレーションの適用
npm run db:reset

# 5. 型定義の生成
npm run db:types

# 6. 開発サーバーの起動
npm run dev
```

### 日常的な開発コマンド

```bash
# 型エラーをウォッチ（別ターミナルで起動）
npm run typecheck -- --watch

# Vitest ウォッチモード（保存時に対象テストのみ再実行）
npm run test -- --watch

# Playwright UI モード（E2Eテストをブラウザで対話的に実行）
npx playwright test --ui

# Supabase スキーマ差分の確認（マイグレーション作成前）
supabase db diff

# Supabase Local の起動状態を確認
supabase status

# DBの初期化（マイグレーションを最初から再適用）
npm run db:reset

# 型定義の再生成（マイグレーション変更後に必須）
npm run db:types
```

開発フロー上の用途:

| シーン | 推奨コマンド |
|--------|-------------|
| ロジック修正中 | `npm run test -- --watch` で対象テストを常時実行 |
| API実装中 | `npm run dev` + `npm run typecheck -- --watch` を別ターミナルで併用 |
| E2Eシナリオ検証 | `npx playwright test --ui` でステップを目視確認 |
| マイグレーション追加後 | `npm run db:reset` → `npm run db:types` → 型エラー解消 |

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
- [ ] `npm run test` がパスするか
- [ ] `npm run typecheck` がパスするか
- [ ] `npm run lint` がパスするか

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
2. ローカルで `npm run db:reset` して正常適用を確認
3. RLSポリシーを必ず設定する
4. `npm run db:types` で型定義を再生成してコミットに含める
