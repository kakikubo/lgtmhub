# lgtmhub

LGTM 画像を GitHub 上のコードレビューに気軽に貼り付けられる、安心安全な LGTM 画像共有サービス。

詳細仕様は `docs/` 配下の永続ドキュメントを参照してください。

- [Product Requirements (PRD)](./docs/product-requirements.md)
- [Functional Design](./docs/functional-design.md)
- [Architecture](./docs/architecture.md)
- [Repository Structure](./docs/repository-structure.md)
- [Development Guidelines](./docs/development-guidelines.md)
- [Glossary](./docs/glossary.md)

---

## 開発環境セットアップ

### 前提

| ツール | バージョン | 備考 |
|--------|-----------|------|
| Node.js | v24.x | mise / nvm 等でバージョン管理推奨 |
| npm | 11.x | Node.js v24 に同梱 |
| Docker | 最新 | Supabase Local 起動に必要 |

開発環境は devcontainer での起動も可能(`.devcontainer/devcontainer.json` 参照)。

### 初回セットアップ

```bash
# 1. 依存パッケージのインストール
npm install

# 2. 環境変数の設定
cp .env.example .env.local
# .env.local を編集(Supabase / Vercel Blob / GitHub OAuth の値を記入)

# 3. Supabase Local の起動(Docker が起動している必要あり)
npm run db:start

# 4. マイグレーションの適用と型生成(マイグレーションが追加されてから)
npm run db:reset
npm run db:types

# 5. 開発サーバーの起動
npm run dev
```

### GitHub OAuth セットアップ

GitHub OAuth でログインを動かすには、ローカル用の OAuth App を 1 つ用意します。

1. https://github.com/settings/developers → **New OAuth App**
2. 各項目を以下で入力:
   - **Application name**: 任意(例: `lgtmhub-local`)
   - **Homepage URL**: `http://localhost:3000`
   - **Authorization callback URL**: `http://localhost:54321/auth/v1/callback`
3. 作成後に表示される Client ID / Client Secret を `.env.local` に貼り付け:
   ```
   GITHUB_OAUTH_CLIENT_ID=<your_client_id>
   GITHUB_OAUTH_CLIENT_SECRET=<your_client_secret>
   ```
4. Supabase CLI に env を渡してから再起動する。**CLI は `.env.local` を読まない**(Next.js の規約のためで、Supabase は別物)ので、以下のいずれかで env を渡す必要がある:
   - 推奨: `cp .env.local supabase/.env` (CLI が自動で読む。`supabase/.env` は `.gitignore` 済み)
   - または: シェルに `set -a && source .env.local && set +a` してから `npm run db:start`

   反映確認: 起動ログに `WARN: environment variable is unset: GITHUB_OAUTH_*` が出ないこと。
5. `npm run db:stop && npm run db:start` で再起動(`supabase/config.toml` の `[auth.external.github]` がこれらの env を参照する)
6. `npm run dev` でトップページを開き、**GitHub でログイン** ボタンから動作確認

> 本番(Vercel)へのデプロイ時は別途 OAuth App を用意し、Authorization callback URL を Supabase プロジェクトの URL(`https://<project-ref>.supabase.co/auth/v1/callback`)に設定したうえで、Supabase Dashboard の Auth > Providers > GitHub に Client ID / Secret を登録します。

### 日常的な開発コマンド

```bash
# 型エラーをウォッチ
npm run typecheck -- --watch

# Vitest ウォッチモード
npm run test -- --watch

# Playwright UI モード
npx playwright test --ui

# Supabase スキーマ差分の確認
supabase db diff

# DBの初期化
npm run db:reset
```

詳細は [`docs/development-guidelines.md`](./docs/development-guidelines.md) を参照してください。

---

## ライセンス

[MIT](./LICENSE)
