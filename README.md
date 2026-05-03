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
