# 要求内容: プロジェクトscaffolding

## 目的

`docs/` 配下で定義されたアーキテクチャ・ディレクトリ構造・技術スタック・開発規約を、実際のコードベースに反映する。後続のすべての機能実装(GitHub OAuth認証以降)が即座に着手できる「動く土台」を整備する。

## 背景

- プロジェクトリポジトリにはドキュメントのみが存在し、実コード(`package.json`、`src/`、`app/`、`supabase/`、設定ファイル等)が一切ない
- `/add-feature` で機能実装に進むためには、最低限の Next.js プロジェクト基盤・テスト基盤・Supabase セットアップが必要
- ドキュメント駆動開発の原則に従い、scaffolding 自体も `docs/` の内容を変更せず、コードがドキュメントに従う形で実装する

## 範囲

### 含むもの

1. **Next.js 15 App Router の初期化**
   - `package.json`, `tsconfig.json`, `next.config.ts`
   - ルート `app/layout.tsx`, `app/(site)/layout.tsx`, `app/(site)/page.tsx` の最小スタブ
   - Tailwind CSS 4.x のセットアップ(CSS-firstアプローチ)

2. **ディレクトリ構造の整備(`docs/repository-structure.md` 準拠)**
   - `app/`, `app/(site)/`, `app/api/auth/callback/`, `app/api/images/`, `app/api/favorites/`
   - `src/services/`, `src/repositories/`, `src/lib/{image,http,supabase,validation}/`, `src/types/`
   - `components/{ui}/`, `tests/{unit,integration,e2e}/`, `supabase/{migrations}/`, `public/`
   - 空ディレクトリは `.gitkeep` で保持

3. **共通基盤コードの配置**
   - `src/lib/errors.ts`(AppError 基底 + 5サブクラス、`docs/development-guidelines.md` 準拠)
   - `src/lib/supabase/server.ts`(Server Component / Route Handler 用 createClient)
   - `src/lib/supabase/client.ts`(Client Component 用 createClient)

4. **開発ツール設定**
   - ESLint 9.x(Next.js 公式設定 + TypeScript)
   - Prettier 3.x(`docs/development-guidelines.md` 規約: `singleQuote: true`, `printWidth: 100`, `trailingComma: 'all'`, `semi: true`, `arrowParens: 'always'`)
   - Vitest 3.x(unit / integration テスト基盤、カバレッジ閾値 services 90% / lib 80%)
   - Playwright 1.5x(E2E テスト基盤)

5. **Supabase Local セットアップ**
   - `supabase` CLI を devDependency として追加
   - `npx supabase init` で `supabase/config.toml` を生成
   - `supabase/migrations/` ディレクトリ・`supabase/seed.sql` を配置(中身は空でOK、後続機能でマイグレーション追加)

6. **環境変数テンプレート**
   - `.env.example`(`docs/development-guidelines.md` 準拠の全変数を列挙、ローカル開発用デフォルト値を含める)
   - `.env.local` は `.gitignore` 済みの前提

7. **GitHub Actions CI**
   - `.github/workflows/ci.yml`(`docs/development-guidelines.md` の YAML をほぼそのまま採用)
   - lint / typecheck / unit / integration / e2e / security audit の各ジョブ

8. **devcontainer 設定**
   - `.devcontainer/devcontainer.json`(Node 24 + Docker-in-Docker、`CLAUDE.md` の「開発環境: devcontainer」前提を満たす)

9. **README 更新**
   - 初回セットアップ手順を `docs/development-guidelines.md`「開発環境セットアップ」と同期させる

### 含まないもの

- 各機能(画像登録・OAuth認証・お気に入り等)のビジネスロジック実装
- DB マイグレーション SQL の中身(`user_profiles`, `lgtm_images` 等のテーブル定義)
- API Route Handler / Service / Repository の中身
- UI コンポーネントの実装

## 成功条件

- [ ] `npm install` が成功する
- [ ] `npm run typecheck` がエラーなしで通る
- [ ] `npm run lint` がエラーなしで通る
- [ ] `npm test` がテスト未存在でも成功扱いとなる(`--passWithNoTests` 相当)、または最低限の smoke test が通る
- [ ] `npm run dev` で Next.js が起動し、`http://localhost:3000` がトップページを返す
- [ ] `docs/repository-structure.md` のディレクトリツリーと実ファイル構造が一致する
- [ ] `docs/development-guidelines.md` の Prettier / ESLint / Vitest 設定が反映されている

## 制約

- `docs/` 配下のドキュメントは変更しない(scaffolding 完了後に必要があれば別タスクで更新)
- TypeScript 6.x / Node.js 24.11.0 / npm 11.x / Next.js 15.x を遵守
- 1PR = 1関心事原則に従い、scaffolding 単体でマージ可能な状態にする
