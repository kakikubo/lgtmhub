# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

```
lgtmhub/
├── app/                        # Next.js App Router（Presentation + API Layer）
│   ├── (site)/                 # 画面グループ（レイアウト共有）
│   │   ├── layout.tsx          # 共通レイアウト（ヘッダー等）
│   │   ├── page.tsx            # 画像一覧トップページ
│   │   ├── images/
│   │   │   ├── new/page.tsx    # 画像登録フォーム
│   │   │   └── [id]/page.tsx   # 画像詳細ページ
│   │   └── favorites/
│   │       └── page.tsx        # お気に入り一覧
│   ├── api/                    # API Layer（Route Handlers）
│   │   ├── auth/
│   │   │   └── callback/route.ts   # GitHub OAuth コールバック
│   │   ├── images/
│   │   │   ├── route.ts            # GET（一覧）/ POST（登録）
│   │   │   └── [id]/route.ts       # DELETE（削除）
│   │   └── favorites/
│   │       ├── route.ts            # GET（一覧）/ POST（追加）
│   │       └── [lgtmImageId]/route.ts  # DELETE（解除）
│   ├── globals.css
│   └── layout.tsx              # ルートレイアウト
├── src/                        # ビジネスロジック・ユーティリティ
│   ├── services/               # Service Layer（ビジネスロジック）
│   │   ├── image-service.ts
│   │   └── favorite-service.ts
│   ├── repositories/           # Data Layer（DB・Blob アクセス）
│   │   ├── image-repository.ts
│   │   ├── favorite-repository.ts
│   │   └── daily-upload-count-repository.ts
│   ├── lib/                    # 技術ユーティリティ（フレームワーク非依存）
│   │   ├── errors.ts               # ドメインエラークラス集約
│   │   ├── image/
│   │   │   ├── compose-lgtm.ts     # LGTM文字合成
│   │   │   ├── calculate-phash.ts  # pHash計算
│   │   │   └── validate-image.ts   # フォーマット・サイズ検証
│   │   ├── http/
│   │   │   └── safe-fetch.ts       # SSRF対策付きfetch
│   │   ├── validation/             # zod スキーマ集約（API入力検証）
│   │   │   ├── image.ts            # 画像登録・削除リクエスト
│   │   │   └── favorite.ts         # お気に入り追加・解除リクエスト
│   │   └── supabase/
│   │       ├── client.ts           # クライアントサイドSupabase
│   │       └── server.ts           # サーバーサイドSupabase
│   └── types/                  # 共通型定義
│       ├── image.ts
│       ├── favorite.ts
│       ├── user.ts
│       └── database.types.ts   # Supabaseスキーマから自動生成（npm run db:types）
├── components/                 # 再利用可能なReactコンポーネント
│   ├── ui/                     # 汎用UIプリミティブ
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   └── toast.tsx
│   ├── image-card.tsx          # 画像カード（サムネイル + コピーボタン）
│   ├── image-grid.tsx          # 画像グリッド一覧
│   ├── favorite-button.tsx     # お気に入りボタン
│   ├── copy-markdown-button.tsx # マークダウンコピーボタン
│   ├── image-register-form.tsx # 画像登録フォーム
│   └── header.tsx              # グローバルヘッダー
├── supabase/                   # Supabase設定・マイグレーション
│   ├── migrations/             # SQLマイグレーションファイル
│   │   ├── 20260502000000_create_user_profiles.sql
│   │   ├── 20260502000001_create_lgtm_images.sql
│   │   ├── 20260502000002_create_favorites.sql
│   │   └── 20260502000003_create_daily_upload_counts.sql
│   ├── seed.sql                # 開発用シードデータ
│   └── config.toml             # Supabase Local設定
├── tests/                      # テストコード
│   ├── unit/                   # ユニットテスト（Vitest）
│   │   ├── lib/
│   │   │   ├── image/
│   │   │   │   ├── compose-lgtm.test.ts
│   │   │   │   └── calculate-phash.test.ts
│   │   │   ├── http/
│   │   │   │   └── safe-fetch.test.ts
│   │   │   └── validation/
│   │   │       ├── image.test.ts
│   │   │       └── favorite.test.ts
│   │   └── services/
│   │       ├── image-service.test.ts
│   │       └── favorite-service.test.ts
│   ├── integration/            # 統合テスト（Vitest + Supabase Local）
│   │   ├── images/
│   │   │   └── image-crud.test.ts
│   │   └── favorites/
│   │       └── favorite-crud.test.ts
│   └── e2e/                    # E2Eテスト（Playwright）
│       ├── image-list.test.ts
│       ├── image-register.test.ts
│       └── favorites.test.ts
├── public/                     # 静的アセット
│   ├── favicon.ico
│   └── og-image.png
├── docs/                       # プロジェクトドキュメント
│   ├── ideas/                  # 壁打ち・アイデアメモ
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   └── glossary.md
├── .github/                    # GitHub設定
│   └── workflows/
│       └── ci.yml              # Lint/型チェック/テスト/E2E（development-guidelines.md参照）
├── .claude/                    # Claude Code設定
├── .steering/                  # 作業単位のタスク管理
├── .env.local                  # ローカル環境変数（gitignore）
├── .env.example                # 環境変数テンプレート（git管理）
├── .gitignore
├── .prettierrc
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── tsconfig.json
├── vitest.config.ts
├── CLAUDE.md
└── README.md
```

---

## ディレクトリ詳細

### `app/` (Presentation Layer + API Layer)

**役割**: Next.js App Routerのファイルベースルーティング。画面コンポーネント（Server/Client Components）とHTTP APIエンドポイント（Route Handlers）を配置する。

**配置ファイル**:
- `page.tsx`: ページコンポーネント（Server Component）
- `layout.tsx`: レイアウトコンポーネント
- `route.ts`: API Route Handler（GET/POST/DELETE等を named export で定義）
- `loading.tsx`: ローディングUI
- `error.tsx`: エラーUI

**命名規則**:
- ファイル名はNext.js規約に従い小文字
- ルートグループは `(name)` 形式
- 動的ルートは `[param]` 形式

**依存関係**:
- 依存可能: `src/services/`（Server Components・Route Handlersから直接）、`components/`、`src/types/`、`src/lib/`
- 依存禁止: `src/repositories/`（Service Layerを経由する）

**例**:
```
app/api/images/route.ts  →  src/services/image-service.ts  →  src/repositories/image-repository.ts
```

**例外: `app/api/auth/callback/route.ts`**:
- GitHub OAuth のコールバック処理のみを担い、Supabase Auth のセッション確立に必要な `src/lib/supabase/server.ts` を直接利用する
- ビジネスロジックを含まないため `src/services/` を経由しない（経由する必要のあるロジックも存在しない）
- 認証コールバックは Next.js / Supabase の規約に従った実装が必要であり、本ルートのみ Service Layer 経由ルールから明示的に除外する

---

### `src/services/` (Service Layer)

**役割**: ビジネスロジックを実装する。HTTP / UIへの依存を持たない純粋なサービス層。

**配置ファイル**:
- `image-service.ts`: 画像登録・削除・一覧取得のオーケストレーション
- `favorite-service.ts`: お気に入りの追加・解除・一覧取得

**命名規則**:
- ファイル名: `{機能名}-service.ts`（kebab-case）
- クラス名: `ImageService`（PascalCase）

**依存関係**:
- 依存可能: `src/repositories/`、`src/lib/`、`src/types/`
- 依存禁止: `app/`、`components/`（HTTPレスポンスやReactへの依存禁止）

**例**:
```
src/services/
├── image-service.ts    # 画像登録（取得→検証→重複チェック→合成→保存→DB）
└── favorite-service.ts # お気に入りCRUD
```

---

### `src/repositories/` (Data Layer)

**役割**: Supabase DB / Vercel Blob / 外部HTTPリクエストを抽象化する。SQLクエリとストレージアクセスをここに閉じ込める。

**配置ファイル**:
- `image-repository.ts`: `lgtm_images` テーブルのCRUD、pHash検索
- `favorite-repository.ts`: `favorites` テーブルのCRUD
- `daily-upload-count-repository.ts`: 日次カウントのUPSERT・取得

**命名規則**:
- ファイル名: `{エンティティ名}-repository.ts`（kebab-case）
- クラス名: `ImageRepository`（PascalCase）

**依存関係**:
- 依存可能: `src/lib/supabase/`、`src/types/`
- 依存禁止: `src/services/`、`app/`、`components/`

---

### `src/lib/` (技術ユーティリティ)

**役割**: フレームワーク非依存の技術ライブラリ。画像処理・SSRF対策・Supabaseクライアントなど、他のレイヤーから横断的に利用される処理を配置。

**サブディレクトリ・主要ファイル**:

| パス | 役割 |
|------|------|
| `errors.ts` | ドメインエラークラス（`AppError` / `NotFoundError` 等）の集約。新規エラーは必ずここに追加する |
| `image/` | Sharp を使った画像合成・pHash計算・フォーマット検証 |
| `http/` | SSRF対策付きfetch、プライベートIP検証 |
| `validation/` | zod スキーマの集約。Route Handler から import して入力検証に利用する。スキーマはエンドポイント単位ではなくドメイン単位で配置する |
| `supabase/` | Server / Client 向けSupabaseクライアント初期化 |

**命名規則**:
- ファイル名: `{動詞}-{対象}.ts`（kebab-case）
- 例: `compose-lgtm.ts`, `calculate-phash.ts`, `safe-fetch.ts`

**依存関係**:
- 依存可能: `src/types/`、外部npm
- 依存禁止: `src/services/`、`src/repositories/`（循環防止）

---

### `src/types/` (型定義)

**役割**: プロジェクト全体で使う TypeScript 型・インターフェースを集約。

**配置ファイル**:
- `image.ts`: `LgtmImage` インターフェース、`ImageStatus` 型
- `favorite.ts`: `Favorite` インターフェース
- `user.ts`: `UserProfile` インターフェース
- `database.types.ts`: Supabase スキーマから自動生成された型定義（`npm run db:types` で生成）

**命名規則**:
- ファイル名: `{エンティティ名}.ts`（kebab-case または単数形）
- 自動生成ファイル: `database.types.ts`（生成器の出力名に合わせる）

**自動生成ファイルの扱い**:
- `database.types.ts` は **コミット対象**（マイグレーションと同期させ、CI で型チェックの対象にするため）
- マイグレーション変更後は `npm run db:types` を実行し、再生成された型を必ずコミットに含める

**依存関係**:
- 依存可能: なし（型定義のみ）
- 依存禁止: すべての実装レイヤー（型は依存関係の末端に位置する）

---

### `components/` (Reactコンポーネント)

**役割**: 再利用可能な React コンポーネント。ページ固有のコンポーネントは `app/` 配下に置き、複数ページで使うものだけここに配置する。

**サブディレクトリ**:

| ディレクトリ | 役割 |
|------------|------|
| `ui/` | shadcn/ui 等の汎用UIプリミティブ（Button, Dialog, Toast等） |
| （ルート直下） | ドメイン固有の共有コンポーネント |

**命名規則**:
- ファイル名: `{機能名}.tsx`（kebab-case）
- コンポーネント名: `ImageCard`（PascalCase）

**依存関係**:
- 依存可能: `src/types/`、`src/lib/supabase/client.ts`（クライアントコンポーネントのみ）
- 依存禁止: `src/services/`、`src/repositories/`（APIを経由するか Server Component 経由で渡す）

---

### `supabase/` (DBマイグレーション)

**役割**: Supabase CLIで管理するDBスキーマのマイグレーションとローカル設定。

**命名規則**:
- マイグレーションファイル: `YYYYMMDDHHMMSS_{説明}.sql`（Supabase CLIが自動付与）
- 例: `20260502000000_create_user_profiles.sql`

**注意**:
- マイグレーションは一度適用したら変更しない（新しいマイグレーションで修正）
- `config.toml` でポート・サービス設定を管理（ローカル開発用）

---

### `tests/` (テストコード)

**役割**: ソースコードとテストコードを分離し、テストタイプごとにディレクトリを分割する。

**構造**:

```
tests/
├── unit/           # Vitest、依存をモック、高速
├── integration/    # Vitest + Supabase Local（Docker）、DB実起動
└── e2e/            # Playwright、ブラウザ自動化
```

**命名規則**:
- ユニット / 統合テスト: `{対象ファイル名}.test.ts`
- E2Eテスト: `{ユーザーシナリオ}.test.ts`

**対応関係**:
| ソース | テスト |
|--------|--------|
| `src/lib/image/compose-lgtm.ts` | `tests/unit/lib/image/compose-lgtm.test.ts` |
| `src/services/image-service.ts` | `tests/unit/services/image-service.test.ts` |
| 画像登録フロー全体 | `tests/integration/images/image-crud.test.ts` |
| 未ログインで閲覧・コピー | `tests/e2e/image-list.test.ts` |

---

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ページコンポーネント | `app/(site)/*/page.tsx` | Next.js規約 | `app/(site)/favorites/page.tsx` |
| API Route Handler | `app/api/*/route.ts` | Next.js規約 | `app/api/images/route.ts` |
| 共有Reactコンポーネント | `components/` | kebab-case.tsx | `components/image-card.tsx` |
| ビジネスロジック | `src/services/` | kebab-case-service.ts | `src/services/image-service.ts` |
| DBアクセス | `src/repositories/` | kebab-case-repository.ts | `src/repositories/image-repository.ts` |
| 技術ユーティリティ | `src/lib/` | kebab-case.ts | `src/lib/image/compose-lgtm.ts` |
| 型定義 | `src/types/` | kebab-case.ts | `src/types/image.ts` |
| DBマイグレーション | `supabase/migrations/` | `YYYYMMDDHHMMSS_*.sql` | `20260502000000_create_lgtm_images.sql` |

### 設定ファイル

| ファイル | 役割 |
|---------|------|
| `next.config.ts` | Next.js設定（画像ドメイン許可等） |
| `tsconfig.json` | TypeScript設定（`@/*` パスエイリアス） |
| `vitest.config.ts` | Vitestテスト設定 |
| `playwright.config.ts` | Playwrightテスト設定 |
| `eslint.config.mjs` | ESLint設定 |
| `.prettierrc` | Prettier設定 |
| `.env.example` | 環境変数テンプレート（git管理対象） |
| `.env.local` | ローカル環境変数（**git管理対象外**） |

---

## 命名規則

### ディレクトリ名

| 種別 | 規則 | 例 |
|------|------|-----|
| レイヤーディレクトリ | 複数形、kebab-case | `services/`, `repositories/`, `components/` |
| 機能サブディレクトリ | 単数形または機能名、kebab-case | `image/`, `http/`, `supabase/` |
| Next.jsルートグループ | `(name)` 形式 | `(site)/` |
| Next.js動的ルート | `[param]` 形式 | `[id]/` |

### ファイル名

| 種別 | 規則 | 例 |
|------|------|-----|
| Reactコンポーネント | kebab-case.tsx | `image-card.tsx` |
| サービスクラス | kebab-case-service.ts | `image-service.ts` |
| リポジトリクラス | kebab-case-repository.ts | `image-repository.ts` |
| ユーティリティ関数 | 動詞-対象.ts（kebab-case） | `compose-lgtm.ts`, `safe-fetch.ts` |
| 型定義 | エンティティ名.ts | `image.ts`, `user.ts` |
| テストファイル | `{対象}.test.ts` | `compose-lgtm.test.ts` |

### TypeScript識別子

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス名 | PascalCase | `ImageService`, `FavoriteRepository` |
| コンポーネント名 | PascalCase | `ImageCard`, `CopyMarkdownButton` |
| インターフェース名 | PascalCase（接頭辞Iなし） | `LgtmImage`, `UserProfile` |
| 型エイリアス | PascalCase | `ImageStatus`, `MimeType` |
| 変数・関数 | camelCase | `composeLgtmImage`, `calculatePHash` |
| 定数（モジュールスコープ） | UPPER_SNAKE_CASE | `DUPLICATE_THRESHOLD`, `MAX_DAILY_UPLOADS` |

---

## 依存関係のルール

### レイヤー間の依存

```
app/ (Presentation + API)
    ↓
src/services/ (Service)
    ↓
src/repositories/ (Data)
    ↓
Supabase / Vercel Blob

components/  →  src/types/（型のみ）
src/lib/     →  src/types/・外部npm
src/types/   →  依存なし（末端）
```

**禁止される依存**:
- `src/repositories/` → `src/services/` ❌
- `src/services/` → `app/` ❌
- `src/services/` → `components/` ❌
- `src/lib/` → `src/services/` ❌（循環防止）
- クライアントコンポーネント → `src/repositories/` ❌（APIを経由すること）

### パスエイリアス（`tsconfig.json`）

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- `@/src/services/image-service` のように絶対パスで import する
- 相対パス `../../` の多用を禁止

**主な参照パターン**:

```typescript
// app/api/* から service / lib を参照
import { imageService } from '@/src/services/image-service';
import { createClient } from '@/src/lib/supabase/server';

// app/(site)/* から components / types を参照
import { ImageCard } from '@/components/image-card';
import type { LgtmImage } from '@/src/types/image';

// components/ から lib（クライアント専用）を参照
import { createClient } from '@/src/lib/supabase/client';

// service / repository から types / lib を参照
import type { Database } from '@/src/types/database.types';
import { DuplicateImageError } from '@/src/lib/errors';
```

---

## P1フェーズで追加予定のファイル

PRD で P1 と定義された機能（管理者削除・通報・物理クリーンアップ・ファイルアップロード）に必要なファイルを以下に列挙する。MVP のツリーには含めず、P1 着手時に本リストに従って配置する。

### 機能6: 管理者による画像削除（操作ログ）

```
src/repositories/admin-log-repository.ts        # 管理者操作ログ CRUD
src/services/admin-service.ts                   # 管理者削除フロー（論理削除+即時Blob物理削除）
src/lib/validation/admin.ts                     # 管理者操作APIのzodスキーマ
app/api/admin/images/[id]/route.ts              # 管理者削除専用エンドポイント
supabase/migrations/*_create_admin_logs.sql     # 管理者操作ログテーブル
tests/unit/services/admin-service.test.ts
tests/integration/admin/admin-delete.test.ts
```

### 機能7: ユーザー通報機能

```
src/types/report.ts                             # ImageReport インターフェース
src/repositories/report-repository.ts           # 通報CRUD・閾値判定クエリ
src/services/report-service.ts                  # 通報追加・5件超過時の自動非表示
src/lib/validation/report.ts                    # 通報APIのzodスキーマ
app/api/reports/route.ts                        # POST（通報送信）
supabase/migrations/*_create_image_reports.sql  # image_reports テーブル
tests/unit/services/report-service.test.ts
tests/integration/reports/report-flow.test.ts
```

### 機能8: 削除画像の物理クリーンアップ

```
src/services/cleanup-service.ts                 # deleted_at から30日経過した画像のBlob/DB削除
.github/workflows/cleanup.yml                   # 日次クリーンアップジョブ
tests/unit/services/cleanup-service.test.ts
```

### 機能9: ファイルアップロード対応

```
components/image-upload-form.tsx                # ドラッグ&ドロップ + ファイル選択UI
src/lib/image/validate-upload.ts                # アップロードファイルのMIME/サイズ検証
# 既存の app/api/images/route.ts を multipart/form-data 対応に拡張
# 既存の src/services/image-service.ts に createImageFromUpload() を追加
tests/unit/lib/image/validate-upload.test.ts
tests/e2e/image-upload.test.ts
```

> P1 着手時にこのリストを参照しつつ、不要になったファイルや追加が必要なファイルを順次更新する。
> 上記の配置先は MVP の命名規則・依存ルール（本ドキュメント前段で定義済み）に従う。

---

## スケーリング戦略

### 機能の追加方針

| 規模 | 対応 |
|------|------|
| 小規模（1-2ファイル） | 既存ディレクトリに追加 |
| 中規模（3-10ファイル） | `src/services/` 内にサブディレクトリを作成 |
| 大規模（機能独立性が高い） | `src/modules/{機能名}/` として分離を検討 |

### ファイルサイズの管理

- 1ファイル 300行以下を目安
- 300行超: リファクタリングを検討
- 500行超: 分割を強く推奨

---

## 除外設定

### `.gitignore`

```
node_modules/
.next/
.env.local
*.log
.DS_Store
coverage/
playwright-report/
test-results/
```

### `.prettierignore` / `.eslintignore`

```
node_modules/
.next/
supabase/migrations/    # 自動生成SQLはフォーマット対象外
coverage/
playwright-report/
```
