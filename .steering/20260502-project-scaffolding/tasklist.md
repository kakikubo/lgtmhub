# タスクリスト: プロジェクトscaffolding

## Phase 1: パッケージ管理基盤

- [x] T1-1 `package.json` を作成し、依存パッケージ(prod / dev)を `docs/architecture.md` の依存 JSON に従って記述する
- [x] T1-2 `tsconfig.json` を作成(`paths: { "@/*": ["./*"] }`、`strict`、`noUncheckedIndexedAccess` 有効)
- [x] T1-3 `next.config.ts` を作成(Vercel Blob ドメイン許可)
- [x] T1-4 `npm install` を実行し、`node_modules` を生成する

## Phase 2: ディレクトリ構造の整備

- [x] T2-1 `app/`, `app/(site)/`, `app/api/{auth/callback,images,favorites}/` ディレクトリと `.gitkeep` を配置
- [x] T2-2 `src/{services,repositories,lib/{image,http,supabase,validation},types}/` ディレクトリと `.gitkeep` を配置
- [x] T2-3 `components/ui/` ディレクトリと `.gitkeep` を配置
- [x] T2-4 `tests/{unit,integration,e2e}/` ディレクトリと `.gitkeep` を配置
- [x] T2-5 `public/` ディレクトリと `.gitkeep` を配置

## Phase 3: ルート Next.js ファイル

- [x] T3-1 `app/layout.tsx`(ルートレイアウト)を作成
- [x] T3-2 `app/(site)/layout.tsx`(共通レイアウト)を作成
- [x] T3-3 `app/(site)/page.tsx`(scaffolding 完了の仮トップページ)を作成
- [x] T3-4 `app/globals.css`(Tailwind import)を作成
- [x] T3-5 `postcss.config.mjs`(Tailwind 4 PostCSS plugin)を作成
- [x] T3-6 `next-env.d.ts` / `global.d.ts`(Next.js 標準型 + CSS module 型宣言)を追加 ※当初想定外だがTypeScript strict環境で必須

## Phase 4: 共通基盤コード

- [x] T4-1 `src/lib/errors.ts` を作成(`AppError`, `NotFoundError`, `DuplicateImageError`, `DailyLimitExceededError`, `BadRequestError`, `DatabaseError`)
- [x] T4-2 `src/lib/supabase/server.ts`(Server Component / Route Handler 用 createClient)を作成
- [x] T4-3 `src/lib/supabase/client.ts`(Client Component 用 createClient)を作成

## Phase 5: 開発ツール設定

- [x] T5-1 `eslint.config.mjs`(Next.js + TypeScript 用 Flat Config)を作成
- [x] T5-2 `.prettierrc`(development-guidelines.md 準拠)と `.prettierignore` を作成
- [x] T5-3 `vitest.config.ts`(カバレッジ閾値 services 90% / lib 80% を含む)を作成
- [x] T5-4 `playwright.config.ts`(localhost:3000 を webServer に指定)を作成

## Phase 6: テストの最低限の整備

- [x] T6-1 `tests/unit/lib/errors.test.ts`(AppError 派生クラスの smoke test、6 cases)を作成

## Phase 7: Supabase Local 初期化

- [x] T7-1 `npx supabase init --yes --workdir .` で `supabase/config.toml` を生成
- [x] T7-2 `supabase/config.toml` の `project_id` が `lgtmhub` に設定済みであることを確認(リポジトリ名から自動取得)
- [x] T7-3 `supabase/migrations/.gitkeep`、`supabase/seed.sql`(空のコメント付き)を配置

## Phase 8: 環境変数 / ドキュメント

- [x] T8-1 `.env.example` を作成(全環境変数を列挙、ローカル URL のみデフォルト値)
- [x] T8-2 `.gitignore` に Playwright 出力・Supabase の `.temp/` を追加(既存テンプレに差分のみ)
- [x] T8-3 `README.md` を更新(初回セットアップ手順を `docs/development-guidelines.md` と同期)

## Phase 9: CI / devcontainer

- [x] T9-1 `.github/workflows/ci.yml` を作成(`docs/development-guidelines.md` の YAML を採用)
- [x] T9-2 `.devcontainer/devcontainer.json` を作成

## Phase 10: 動作確認

- [x] T10-1 `npm run lint` がエラーなしで通る(ESLint: No issues found)
- [x] T10-2 `npm run typecheck` がエラーなしで通る
- [x] T10-3 `npm test` が pass する(6 tests / 1 file)
- [x] T10-4 `npm run dev` でトップページが 200 を返すことを確認(SIGTERM で終了)
- [x] T10-5 `npm run build` も成功(production build / `/` が prerendered static として生成)

## Phase 11: 仕上げ

- [x] T11-1 git status で意図しない変更が無いことを確認、scaffolding 単一関心事として 1 コミットにまとめる(docs 整合更新は同一コミット内に含める) — `246221f` でコミット完了(48 files / +10299 -12)

---

## 申し送り事項

### 実装完了日
2026-05-02

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| TypeScript バージョン | `~6.0.0` | `~6.0.3`(npm レジストリで利用可能な 6 系最新が公開済み) |
| Next.js バージョン | `15.x.x` 完全固定 | `~15.5.15`(15 系の backport tag 最新)。docs 側も `~15.5.15` に表記更新 |
| `@supabase/ssr` | `^0.5.0` | `^0.10.2`(Cookie API が `getAll/setAll` 形式に変更されている最新)。docs 更新済み |
| `@vercel/blob` | `^0.27.0` | `^2.3.3`(メジャーアップ、`put()` シグネチャ変更あり)。docs 更新済み |
| `zod` | `^3.23.0` | `^4.4.2`(メジャーアップ)。docs 更新済み |
| `global.d.ts` 追加 | 未計画 | TypeScript strict 環境で `import './globals.css'` を解決するため必要だった |
| `next-env.d.ts` の ESLint 除外 | 未計画 | triple-slash-reference 警告を抑制するため `eslint.config.mjs` ignores に追加 |
| `playwright.config.ts` の CI 切替 | 未計画 | validator 指摘で `npm run start` (CI) / `npm run dev` (ローカル) に分岐 |
| `outputFileTracingRoot` 設定 | 未計画 | `~/package-lock.json` を上位に検出する Next.js 警告を抑制するため `next.config.ts` に追加 |

### 学んだこと

1. **Tailwind CSS 4.x は CSS-first アプローチ**: `tailwind.config.ts` は不要。`@import "tailwindcss"` を `app/globals.css` に書き、`postcss.config.mjs` で `@tailwindcss/postcss` プラグインを設定するだけで動く
2. **Next.js 15 の async `cookies()`**: `@supabase/ssr` v0.10 の `createServerClient` は `await cookies()` を要求する。Server Component から呼ばれた場合の `setAll` 例外は握りつぶす(middleware で更新する前提)
3. **Next.js プロジェクトの `npm` lockfile 検出**: 親ディレクトリに `package-lock.json` が存在すると `outputFileTracingRoot` 警告が出る。明示的に `path.resolve(__dirname)` を指定すれば解消
4. **TypeScript `noUncheckedIndexedAccess`**: 配列・オブジェクトのインデックスアクセス結果が `T | undefined` になる。後続実装で `array[i]` のように直接アクセスするコードは `array[i]?` または `if (item) {}` で undefined チェックが必須

### 次回(GitHub OAuth 認証実装)への改善提案

1. **`middleware.ts` の作成を最初のタスクにする**
   - Supabase セッションのリフレッシュは `middleware.ts` で行う前提のため、これを先に作成しないと OAuth コールバック後のセッション維持が不安定になる
   - `src/lib/supabase/server.ts` の `setAll` の握りつぶしコメントで言及済み
   - 推奨配置: ルート直下 `middleware.ts`

2. **`src/lib/errors.ts` に `UnauthorizedError` / `ForbiddenError` を追加**
   - `development-guidelines.md` には「認証エラーは401、認可エラーは403で統一」と明記されているが、対応するエラークラスが未定義
   - OAuth 実装で「未ログインなら401」を Service Layer から throw する際に必要
   - 同時に glossary.md にも追記する

3. **`supabase/migrations/` に `user_profiles` テーブルのマイグレーション SQL を作成**
   - `repository-structure.md` に `20260502000000_create_user_profiles.sql` の名称が示されているが、scaffolding 段階では作成しない方針(関心事分離のため)
   - OAuth 実装で最初に作成する

4. **`.env.local` の値を埋める手順をドキュメント化**
   - GitHub OAuth App の登録手順(Authorization callback URL: `http://localhost:54321/auth/v1/callback` 等)を README に追記する
   - Supabase ローカルの `anon_key` / `service_role_key` の取得方法

5. **`docs/development-guidelines.md` のコードサンプルが zod v4 互換であることを実装時に検証**
   - 例: `z.string().url()` の挙動、エラーオブジェクトの形状(v4 で変更あり)
   - サンプルが動かない場合は `development-guidelines.md` 側を修正する

### scaffolding 範囲外と判断したもの

- **`middleware.ts` の追加**: 認証セッション管理の責務であり、OAuth 実装の本体に含めるべき。1PR=1関心事原則
- **`UnauthorizedError` / `ForbiddenError`**: 同上。エラークラスの追加は OAuth 実装で発生する具体的ニーズに合わせて行う
- **`user_profiles` 等のマイグレーション SQL**: データモデルの定義は機能実装の責務
