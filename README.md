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
# 1. 依存パッケージのインストール(prepare スクリプトで lefthook が自動セットアップされる)
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

### E2E テスト (Playwright)

`npm run test:e2e` 実行時には Playwright の `globalSetup` が「ログイン済み storageState」を生成するため、Supabase Local の `service_role` キーと、テスト専用 sign-in エンドポイント (`/api/auth/test-signin`) を有効化する `E2E_TEST_MODE=true` の 2 点を環境変数として渡す必要があります。

1. `npm run db:start` で Supabase Local を起動
2. キーを取得して `.env.local` に追記:
   ```bash
   supabase status -o json | jq -r '"SUPABASE_SERVICE_ROLE_KEY=\(.SERVICE_ROLE_KEY)"' >> .env.local
   echo "E2E_TEST_MODE=true" >> .env.local
   ```
3. E2E 実行:
   ```bash
   npm run test:e2e
   ```

> **本番では `E2E_TEST_MODE` を絶対に設定しないでください**。`/api/auth/test-signin` は `E2E_TEST_MODE === 'true'` のときのみ email/password sign-in を許可します。未設定なら 403 を返すだけの無害なルートとして振る舞います。

### コミット時の自動チェック (lefthook + Biome)

`npm install` 後、`prepare` スクリプト(`lefthook install`)により `.git/hooks/pre-commit` が配置されます。`git commit` 時にステージ済みのファイル(`*.{js,jsx,ts,tsx,json,jsonc,css}`)に対して `biome check --write` が走り、整形差分の再ステージと lint エラー時のコミット中断を自動で行います。

既存フック(`core.hooksPath` を独自設定している場合など)との競合解消手順は [`docs/development-guidelines.md`](./docs/development-guidelines.md#フォーマット規約) を参照してください。

---

## トラブルシュート

### colima で `npm run db:start` の `supabase_vector` 起動が失敗する

エラー例:

```
failed to start docker container "supabase_vector_lgtmhub":
Error response from daemon: error while creating mount source path
'/Users/<user>/.config/colima/default/docker.sock': mkdir ...: operation not supported
```

原因: `supabase_vector`(analytics ログ収集コンテナ)が Docker socket をマウントしようとした際、colima のソケット実体パスが Docker 側から見えないため失敗します。

> **注意**: 以下の変更はローカル限定です。`supabase/config.toml` の差分は必ずコミット前に戻してください。リポジトリのデフォルトは `enabled = true` のままにします(Docker Desktop / CI ではそのまま動作するため)。

回避手順:

1. `supabase/config.toml` の `[analytics]` ブロックを一時的に `enabled = false` に変更
   ```toml
   [analytics]
   enabled = false
   ```
2. Supabase Local を再起動
   ```bash
   npm run db:stop && npm run db:start
   ```
3. 作業後は必ず差分を元に戻す
   ```bash
   git checkout -- supabase/config.toml
   ```

---

## ライセンス

[MIT](./LICENSE)
