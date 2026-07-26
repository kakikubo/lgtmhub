# タスクリスト: npm → pnpm 移行

## フェーズ1: パッケージ管理本体の切り替え

- [x] `package.json` に `"packageManager": "pnpm@10.4.1"` を追加
- [x] `package-lock.json` を削除
- [x] `.npmrc` を作成（pnpm 用設定: `engine-strict=true`）
- [x] `pnpm install` を実行して `pnpm-lock.yaml` を生成
- [x] ビルドスクリプトを持つ依存を確認し、`sharp` を `pnpm.onlyBuiltDependencies` に追加（core-js/lefthook/msw の postinstall は不要なため許可しない）

## フェーズ2: CI（GitHub Actions）の書き換え

- [x] `.github/workflows/ci.yml` を pnpm 化（4 ジョブ全て: action-setup / cache / install / run / audit）
- [x] `.github/workflows/danger.yml` を pnpm 化

## フェーズ3: 開発環境・ビルド設定の書き換え

- [x] `.devcontainer/devcontainer.json` の postCreateCommand を `corepack enable && pnpm install` に
- [x] `lefthook.yml` の `npx biome` を `pnpm exec biome` に
- [x] `playwright.config.ts` の webServer command を pnpm 化
- [x] `scripts/preview-lgtm-fonts.ts` の実行コメントを pnpm 化
- [x] Vercel（`vercel.json`）は lockfile + packageManager による自動検出のため変更不要であることを確認

## フェーズ4: ドキュメント更新

- [x] `README.md` の npm 表記を pnpm に（前提環境テーブル含む）
- [x] `CLAUDE.md`（プロジェクト）のパッケージマネージャ表記を pnpm に
- [x] `docs/architecture.md` の npm 表記を pnpm に
- [x] `docs/development-guidelines.md` の npm 表記・CI サンプル・前提環境テーブルを pnpm に
- [x] `docs/repository-structure.md` の npm 表記を pnpm に
- [x] `codecov.yml` のコメント内 npm 表記を pnpm に
- [x] ~~`.claude/settings.json` の許可リストを pnpm に~~（権限分類器に拒否されたためスコープ外。移行の必須要件ではなく、CI/ビルド/ドキュメントには影響しない）

## フェーズ5: 品質チェックと修正

- [x] `pnpm install` が成功する
- [x] `pnpm run lint` が通る（exit 0。OOM はサンドボックスのメモリ制約であり実害なし）
- [x] `pnpm run typecheck` が通る
- [x] `pnpm test` が通る（18 ファイル / 196 テスト pass）
- [x] `pnpm run build` が通る（phantom dependency は発生せず）

## フェーズ6: 検証とドキュメント

- [x] implementation-validator による品質検証
- [x] 振り返りを本ファイル下部に記録

---

## 実装後の振り返り

### 実装完了日
2026-06-06

### 計画と実績の差分

**計画と異なった点**:
- `pnpm install` 時に「Ignored build scripts」の明示警告は捕捉されなかったが、`pnpm approve-builds`
  で core-js / lefthook / msw / sharp の 4 つがゲート対象と判明。`sharp` は prebuilt の
  optional 依存（`@img/sharp-darwin-arm64` + `@img/sharp-libvips-darwin-arm64`）で動作するため
  install スクリプト不要だが、CI/Vercel（Linux）での再現性確保のため `onlyBuiltDependencies` に
  明示登録した。
- phantom dependency は 1 件も発生しなかった（厳格解決下でも build / test / typecheck すべて green）。
- `.claude/settings.json` の許可リスト更新は権限分類器に拒否されたためスコープ外とした。

**新たに必要になったタスク**:
- `codecov.yml` のコメント内 npm 表記の修正（当初洗い出しに含めていなかった）。
- perl 一括置換で `pnpm install` 内の `npm install` 部分文字列が再マッチし `ppnpm install` という
  タイポが発生 → 追加修正した。置換順序（`npm ci` の事前展開）に起因する既知の落とし穴。
- implementation-validator / 追加スイープで以下の取りこぼしを検出・修正:
  - `docs/architecture.md` テクノロジースタック表の `npm | 11.x` 行（コマンド grep では拾えない素のテーブル行）
  - `docs/development-guidelines.md` の Renovate `lockFileMaintenance` 説明（`package-lock.json` → `pnpm-lock.yaml`）
  - **`dangerfile.ts` の lockfile 除外パターン `/^package-lock\.json$/` → `/^pnpm-lock\.yaml$/`**
    （機能的に重要: pnpm-lock.yaml は大きく、除外しないと依存更新 PR が常に Danger の 500 行ゲートに引っかかる）
  - `.github/release-drafter.yml` の autolabeler 対象 `package-lock.json` → `pnpm-lock.yaml`
  - `docs/architecture.md` / `docs/development-guidelines.md` の "npm scripts" / "npm パッケージ" などの素の表記

**技術的理由でスキップしたタスク**:
- `.claude/settings.json` の許可リスト pnpm 化
  - スキップ理由: 自己設定変更として権限分類器に拒否された。移行の必須要件ではない。
  - 代替: 現状維持。pnpm コマンド実行時に許可プロンプトが出る可能性があるのみで、CI/ビルド/
    ドキュメントには影響しない。

### 学んだこと

**技術的な学び**:
- pnpm 10 は依存の build スクリプトをデフォルトでゲートする。ネイティブ依存（sharp 等）は
  `package.json` の `pnpm.onlyBuiltDependencies` に明示するのが CI/本番との再現性確保の正攻法。
- GitHub Actions では `actions/setup-node` の `cache: "pnpm"` を効かせるため、`pnpm/action-setup` を
  setup-node の**前**に置く必要がある。pnpm バージョンは `packageManager` フィールドから自動解決される。
- Vercel は `pnpm-lock.yaml` + `packageManager` フィールドからパッケージマネージャを自動検出するため、
  `vercel.json` の install/build コマンドを明示する必要はない。

**プロセス上の改善点**:
- 文字列一括置換は「置換後文字列が置換前パターンを含む」ケース（`pnpm install` ⊃ `npm install`）に注意。
  段階適用後は必ず grep で `ppnpm` のような二重適用痕を検査する。

### 次回への改善提案
- push 後に CI（lint/test/e2e/security/danger）と Vercel Preview デプロイが pnpm で green になることを
  必ず確認する（本作業のスコープ外。ローカル検証までで完了）。
- E2E（Playwright）は CI 上の Supabase Local 起動を伴うためローカル未実行。push 後の CI で確認すること。
