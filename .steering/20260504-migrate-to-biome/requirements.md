# 要求内容

## 概要

Linter/Formatter を Prettier + ESLint から Biome 1 本に置き換える。設定ファイル・依存関係・スクリプト・CI・エディタ統合・ドキュメントを Biome 前提に統一する。

## 背景

GitHub Issue #16 を起点とする。現状の構成では以下の問題がある:

- 実行速度: ESLint + Prettier の 2 段構成のため lint/format が遅い
- 依存関係: `eslint`、`eslint-config-next`、`@eslint/eslintrc`(暗黙)、`prettier` の 3 系統が混在
- 設定の分散: `.prettierrc` / `.prettierignore` / `eslint.config.mjs` の 3 ファイルに責務が分かれている
- 責務の重複: フォーマット系ルールが Prettier と ESLint の両方に存在し得る

Biome (Rust 実装) に統一することで、実行速度の改善・設定一元化・依存削減を狙う。

## 実装対象の機能

### 1. Biome 導入と設定移植

- `@biomejs/biome` を devDependency に追加
- `biome.json` を作成し、現状の `.prettierrc` / `eslint.config.mjs` のルールを可能な限り再現
  - フォーマット: `semi: true` / `singleQuote: true` / `printWidth: 100` / `trailingComma: 'all'` / `arrowParens: 'always'`
  - lint: `next/core-web-vitals` 由来のうち Biome 標準ルールで代替できるもの
  - 無視対象: 現状の `eslint.config.mjs` の `ignores` と `.prettierignore` を統合 (`node_modules/`、`.next/`、`coverage/`、`playwright-report/`、`test-results/`、`supabase/migrations/`、`src/types/database.types.ts`、`next-env.d.ts`)

### 2. npm scripts の更新

- `lint` を `next lint` から `biome lint .`(または `biome ci .`) に切り替え
- 新たに `format` (`biome format --write .`) を追加
- 既存スクリプト (`dev`/`build`/`typecheck`/`test*`/`db:*`) は据え置き

### 3. CI(GitHub Actions) の更新

- `.github/workflows/ci.yml` の `lint-and-typecheck` ジョブで `npm run lint` が Biome を実行するよう、スクリプト切替に追従
  - 必要に応じて `biome ci .` を呼び出す形に微調整(差分検証＋フォーマット検証を 1 コマンドで)
- 他ジョブ(`test`/`e2e`/`security`) は変更なし

### 4. エディタ統合の更新

- `.devcontainer/devcontainer.json` の VS Code 拡張・設定を Biome 前提に更新
  - 拡張: `dbaeumer.vscode-eslint` と `esbenp.prettier-vscode` を削除し、`biomejs.biome` を追加
  - 設定: `editor.defaultFormatter` を `biomejs.biome` に変更、`source.fixAll.eslint` を `quickfix.biome` などに置き換え
  - `bradlc.vscode-tailwindcss` / `denoland.vscode-deno` は据え置き

### 5. 旧ツール関連の削除

- ファイル削除: `.prettierrc`、`.prettierignore`、`eslint.config.mjs`
- `package.json` の `devDependencies` から `eslint`、`eslint-config-next`、`prettier` を削除
- `package-lock.json` を再生成

### 6. ドキュメント更新

- `docs/development-guidelines.md` の「フォーマット規約」セクションを Biome 前提に書き換え
  - Prettier 設定表 → Biome の対応設定表に置き換え
  - 「ESLint基本方針」を「Biome lint 方針」に書き換え
  - 関連箇所(CI スクリプト例、`npm scripts` 例) を新スクリプトに合わせて更新

## 受け入れ条件

### Biome 導入と設定移植

- [ ] `npx biome --version` が成功する
- [ ] `biome.json` が現状の Prettier ルール (`semi`/`singleQuote`/`printWidth: 100`/`trailingComma: all`/`arrowParens: always`) と等価な設定になっている
- [ ] `biome.json` の ignore 設定が、旧 `eslint.config.mjs` の `ignores` と `.prettierignore` を統合している

### npm scripts の更新

- [ ] `npm run lint` が Biome の lint を実行する
- [ ] `npm run format` が Biome の format(--write) を実行する
- [ ] `npm run lint` が現コードベースで成功する(警告あり許容、エラーゼロ)

### CI の更新

- [ ] `.github/workflows/ci.yml` の `lint-and-typecheck` ジョブが Biome ベースで成功する
- [ ] 他ジョブ(`test`/`e2e`/`security`) に意図しない差分がない

### エディタ統合の更新

- [ ] `.devcontainer/devcontainer.json` から ESLint / Prettier 拡張が削除されている
- [ ] `biomejs.biome` 拡張が追加されている
- [ ] `editor.defaultFormatter` が Biome になっている

### 旧ツール関連の削除

- [ ] `.prettierrc` / `.prettierignore` / `eslint.config.mjs` が存在しない
- [ ] `package.json` に `eslint*` / `prettier` が存在しない
- [ ] `package-lock.json` が再生成されている
- [ ] `npm install` がエラーなく完了する

### ドキュメント更新

- [ ] `docs/development-guidelines.md` のフォーマット規約セクションが Biome 前提に更新されている
- [ ] CI スクリプト例 / `npm scripts` 例が新コマンドに更新されている

### 全体検証

- [ ] `npm run lint` が成功
- [ ] `npm run typecheck` が成功
- [ ] `npm run build` が成功
- [ ] `npm run test:unit` が成功
- [ ] `npm run test:integration` が成功
- [ ] `npm run test:e2e` が成功(ローカル / CI どちらか)

## 成功指標

- lint コマンドの実行時間が現状(`next lint`) より明確に短縮されること(計測してログに残す)
- 設定ファイル数が `eslint.config.mjs` + `.prettierrc` + `.prettierignore` の 3 ファイルから `biome.json` 1 ファイルに減ること
- `devDependencies` から最低 3 パッケージ(`eslint` / `eslint-config-next` / `prettier`)が削除されること

## スコープ外

このフェーズでは以下を実装しない:

- Tailwind CSS のクラス順序整列(Biome は本機能を提供しないため、必要なら別 issue で `prettier-plugin-tailwindcss` 専用導入を再検討)
- `next/core-web-vitals` 固有ルール(例: `<Image>`/`<Link>` の使用強制、`@next/next/no-img-element` など) のカスタムプラグイン化(Biome に同等ルールがないものは廃止し、PR レビューで担保する方針とする)
- pre-commit hook(`husky` / `lint-staged`) の追加(現状未導入のため本スコープ外)
- `biome.json` の追加カスタムルール(プロジェクトに必要と判明したら別 issue で対応)

## 移行方針の決定事項(Issue の検討事項に対する回答)

### Next.js デフォルトの ESLint プラグインの扱い

- Biome に同等ルールがない `next/core-web-vitals` 固有ルールは原則として廃止する
- Biome 標準で代替可能なルール(例: `noImgElement`, `noHeadElement` 相当) は `biome.json` で有効化する
- Next.js 固有の Web Vitals チェックは `npm run build` 時の Next.js 警告と PR レビューで担保する
- 必要に応じて将来別 issue でカスタム ESLint を再導入する余地は残す(ただし本スコープでは入れない)

### Tailwind クラス順序整列の扱い

- Biome は Tailwind 並び替えを提供しないため、本スコープでは並び替えを諦める
- どうしても必要となった場合は別 issue で `prettier-plugin-tailwindcss` のみを最小構成で導入する選択肢を検討する

## 参照ドキュメント

- `docs/development-guidelines.md` - 開発ガイドライン(フォーマット規約セクションを更新)
- `docs/architecture.md` - 技術仕様(依存関係管理 / バージョン方針)
- GitHub Issue #16 - 本タスクの起票元
- Biome 公式: https://biomejs.dev/
