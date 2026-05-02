# 設計: プロジェクトscaffolding

## 実装アプローチ

### 全体方針

- **`create-next-app` は使わず手動構築**: 対話型 CLI は自動化に向かず、不要なファイル(`favicon.ico` の生成等)も含まれるため、必要なファイルを直接 Write する
- **依存パッケージは最初から `package.json` で完全宣言**: 段階的に `npm install <pkg>` するより、最終形を一括 install する方が速く、再現性が高い
- **Tailwind CSS 4.x は CSS-first アプローチを採用**: `tailwind.config.ts` を作らず、`app/globals.css` で `@import "tailwindcss"` する。TW 4 の推奨構成
- **`supabase` CLI は npm devDependency で導入**: `architecture.md` の依存 JSON に `"supabase": "^2.0.0"` と明記済み。`npx supabase init` で初期化する
- **空ディレクトリは `.gitkeep` で保持**: 後続機能で具体的なファイルが追加される前提

### バージョン選定

`docs/architecture.md` のテクスタックテーブルおよび依存関係 JSON に従う。

| パッケージ | バージョン | 種別 |
|-----------|-----------|------|
| next | 15.x.x(完全固定) | dependencies |
| react / react-dom | ^19.0.0 | dependencies |
| @supabase/supabase-js | ^2.45.0 | dependencies |
| @supabase/ssr | ^0.5.0 | dependencies |
| @vercel/blob | ^0.27.0 | dependencies |
| sharp | ^0.34.0 | dependencies |
| zod | ^3.23.0 | dependencies |
| tailwindcss | ^4.0.0 | dependencies |
| typescript | ~6.0.0 | devDependencies |
| vitest | ^3.0.0 | devDependencies |
| @playwright/test | ^1.50.0 | devDependencies |
| eslint | ^9.0.0 | devDependencies |
| eslint-config-next | 15.x | devDependencies |
| prettier | ^3.3.0 | devDependencies |
| supabase | ^2.0.0 | devDependencies |
| @types/node | ^24.0.0 | devDependencies |
| @types/react / @types/react-dom | ^19.0.0 | devDependencies |
| postcss / @tailwindcss/postcss | latest | devDependencies |
| @vitest/coverage-v8 | ^3.0.0 | devDependencies |

> 注: `typescript@~6.0.0` が npm レジストリに未公開の場合、TS 6 系の最新 RC または `latest` を採用しつつ、`docs/architecture.md` 側の表記との整合は維持する(今回 scaffolding では検証のため `latest` 解決にフォールバック可能)。

### ディレクトリ・ファイルの配置

`docs/repository-structure.md` のツリーをそのまま採用。空ディレクトリは `.gitkeep` で保持。

```
app/
├── (site)/
│   ├── layout.tsx        # 共通レイアウト(空のヘッダー含む最小)
│   └── page.tsx          # トップページ(scaffold メッセージのみ)
├── api/
│   ├── auth/callback/.gitkeep
│   ├── images/.gitkeep
│   └── favorites/.gitkeep
├── globals.css           # Tailwind import + CSS変数
└── layout.tsx            # ルートレイアウト

src/
├── lib/
│   ├── errors.ts                   # AppError 基底 + 5 サブクラス
│   ├── supabase/{server,client}.ts # createClient ヘルパー
│   ├── image/.gitkeep
│   ├── http/.gitkeep
│   └── validation/.gitkeep
├── services/.gitkeep
├── repositories/.gitkeep
└── types/.gitkeep

components/
└── ui/.gitkeep

tests/
├── unit/.gitkeep
├── integration/.gitkeep
└── e2e/.gitkeep

supabase/
├── config.toml          # supabase init で生成
├── migrations/.gitkeep
└── seed.sql

.devcontainer/
└── devcontainer.json

.github/
└── workflows/
    └── ci.yml

public/.gitkeep
```

### 設定ファイルの内容方針

- **`package.json` scripts**: `docs/development-guidelines.md` の `npm scripts` セクションに記載されたものを採用。`test` は Vitest、`test:e2e` は Playwright、`db:*` 系は supabase CLI 経由。
- **`tsconfig.json`**: Next.js 15 標準 + `paths: { "@/*": ["./*"] }` を含む。`strict: true`、`noUncheckedIndexedAccess: true`(コーディング規約の厳格な型付けを支援)
- **`next.config.ts`**: 画像ドメインは `*.public.blob.vercel-storage.com` を許可しておく(後続の Vercel Blob 利用を想定)
- **`eslint.config.mjs`**: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` の Flat Config 形式
- **`.prettierrc`**: development-guidelines.md「フォーマット規約」と完全一致
- **`vitest.config.ts`**: development-guidelines.md「カバレッジ目標」のコードスニペットをそのまま採用
- **`playwright.config.ts`**: localhost:3000 を `webServer` に指定、`chromium` のみ
- **`app/(site)/page.tsx`**: 「scaffolding 完了。次は GitHub OAuth 認証」とだけ表示する仮ページ。後続機能で差し替えられる前提

### Supabase Local 初期化

- `npx supabase init --workdir .` で `supabase/config.toml` を生成
- `config.toml` のプロジェクト ID を `lgtmhub` に固定
- ポートは Supabase デフォルト(API: 54321, DB: 54322, Studio: 54323)を採用
- `supabase/seed.sql` は空ファイル(後続機能で投入)
- `supabase start` の実行は scaffolding では行わない(Docker 起動が必要なため、後続機能で)

### CI ワークフロー

`docs/development-guidelines.md`「CI/CDパイプライン > GitHub Actions」の YAML をそのままコピーするが、以下のみ調整:
- `node-version` を `'24'` で統一(20系から変えない)
- 統合テストの postgres コンテナのコメントを「CIではPostgresのみ起動、RLSはローカル検証」に揃える(既に development-guidelines.md 側で揃っている)

### devcontainer 設定

- `image`: `mcr.microsoft.com/devcontainers/typescript-node:1-24` をベース
- `features`: docker-in-docker(Supabase Local 用)
- `postCreateCommand`: `npm install`
- VS Code 拡張: ESLint, Prettier, Tailwind CSS IntelliSense

### `.env.example`

```
# Supabase(ローカル開発時は npm run db:start 後に supabase status で取得)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Vercel Blob
BLOB_READ_WRITE_TOKEN=

# GitHub OAuth(Supabase Auth 経由)
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

## 想定リスクと対処

| リスク | 影響 | 対処 |
|--------|------|------|
| TypeScript 6.x がまだ stable でない | npm install 時にエラー | `~6.0.0` で resolve できなければ `latest` にフォールバックし、ドキュメント表記の整合は別タスクで対応 |
| supabase CLI のバイナリが npm 経由で正しく入らない | `npx supabase init` 失敗 | バイナリは postinstall でダウンロードされる仕様。Node 24 で動作確認 |
| Tailwind 4 の PostCSS 設定が変わっている | スタイル適用されない | 公式の `@tailwindcss/postcss` を採用、`postcss.config.mjs` 必須 |
| Playwright の browser インストール時間 | CI が遅い / ローカルが遅い | scaffolding 時はインストールせず、`playwright.config.ts` の用意のみ。E2E テスト追加時に `npx playwright install` |
| GitHub Actions の secrets 未設定 | 初回 CI 実行で失敗 | scaffolding 時の CI は lint/typecheck/unit のみ通すよう、secret 不要なジョブ構成にする |

## テスト戦略

scaffolding 単体ではビジネスロジックがないため、最低限の smoke test のみ:

- **unit**: `tests/unit/lib/errors.test.ts` で AppError 派生クラスの `code`/`message` を検証
- **integration**: scaffolding 時点ではスキップ(対象なし)
- **e2e**: scaffolding 時点ではスキップ(`test:e2e` は別タスク扱い)

これにより `npm test` が成功する状態を担保する。

## 完了判定

- [ ] `npm install` 成功
- [ ] `npm run typecheck` 成功
- [ ] `npm run lint` 成功
- [ ] `npm test` 成功(errors.test.ts が pass)
- [ ] `npm run dev` で `http://localhost:3000` が 200 応答
- [ ] `docs/repository-structure.md` のツリーとリポジトリ実体が一致(空ディレクトリは `.gitkeep` 含む)
