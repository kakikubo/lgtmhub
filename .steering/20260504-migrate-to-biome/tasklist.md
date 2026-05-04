# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: Biome 導入と設定生成

- [x] `@biomejs/biome` を devDependency として追加
  - [x] `npm install -D @biomejs/biome` を実行
  - [x] `npx biome --version` で正常動作を確認
  - [x] `package.json` / `package-lock.json` の差分を確認

- [x] Biome の初期設定を生成
  - [x] `npx biome init` で `biome.json` 雛形を生成
  - [x] 生成内容を確認(後続のマイグレーションで上書きされるため記録)

- [x] Prettier 設定を Biome に取り込む
  - [x] `npx biome migrate prettier --write` を実行
  - [x] `biome.json` の formatter セクションを確認(semi/quote/lineWidth/trailingCommas/arrowParentheses が `.prettierrc` と一致するか)

- [x] ESLint 設定を Biome に取り込む
  - [x] ~~`npx biome migrate eslint --write` を実行~~ (実行方針変更により実行せず: `eslint-config-next` が `@rushstack/eslint-patch` 経由で ESLint v9 と互換性なくロードに失敗。`eslint.config.mjs` のカスタムルールは継承のみで独自ルール定義なし、ignores は Prettier 移行で既に取り込み済みのため自動マイグレーションは不要と判断)
  - [x] 自動変換されなかったルール: `next/core-web-vitals` / `next/typescript` 由来のルールは要求書方針通り廃止(Biome `recommended` で代替できないものは PR レビューで担保)

- [x] `biome.json` を手動調整
  - [x] `formatter.indentStyle: "space"` / `formatter.indentWidth: 2` を明示(Biome デフォルトが tab のため必須)
  - [x] `formatter.lineWidth: 100` を確認
  - [x] `files.includes` で旧 `.prettierignore` + `eslint.config.mjs` の `ignores` を統合
    - [x] `node_modules/**`
    - [x] `.next/**`
    - [x] `coverage/**`
    - [x] `playwright-report/**`
    - [x] `test-results/**`
    - [x] `supabase/migrations/**`
    - [x] `src/types/database.types.ts`
    - [x] `next-env.d.ts`
  - [x] `linter.rules.recommended: true` を確認
  - [x] `$schema` を Biome のバージョンに合わせて設定
  - [x] `style.noNonNullAssertion: "off"` を追加(既存の `process.env.X!` パターンを許容)
  - [x] tests/ override で `suspicious.noThenProperty: "off"` を追加(Supabase クエリビルダーモックの thenable 用)

- [x] フェーズ1のコミット作成
  - [x] 「Biome を導入し設定を移植」の単位でコミット

## フェーズ2: 既存コードの整形(独立コミット)

- [x] 既存コードを Biome 基準で整形
  - [x] `npx biome check --write .` を実行
  - [x] 差分内容を確認(挙動変更がないこと、整形のみであることを確認)
  - [x] 残った Lint 違反があれば内容を確認し、必要なら個別対応

- [x] フェーズ2のコミット作成
  - [x] 「Biome 基準でコードを再整形」として整形差分のみを単独コミット

## フェーズ3: スクリプト・CI・エディタ統合

- [x] `package.json` の scripts を更新
  - [x] `lint` を `biome lint .` に変更
  - [x] `format` (`biome format --write .`) を新規追加
  - [x] `check` (`biome check .`) を新規追加
  - [x] 既存スクリプト(`dev`/`build`/`typecheck`/`test*`/`db:*`) が無変更であることを確認

- [x] `.devcontainer/devcontainer.json` を更新
  - [x] `extensions` から `dbaeumer.vscode-eslint` を削除
  - [x] `extensions` から `esbenp.prettier-vscode` を削除
  - [x] `extensions` に `biomejs.biome` を追加
  - [x] `editor.defaultFormatter` を `biomejs.biome` に変更
  - [x] `editor.codeActionsOnSave` を `quickfix.biome` / `source.organizeImports.biome` に置き換え

- [x] `.github/workflows/ci.yml` の確認
  - [x] `lint-and-typecheck` ジョブが `npm run lint` 経由で Biome を呼ぶことを確認(YAML の差分は発生しない想定)
  - [x] 他ジョブ(`test`/`e2e`/`security`) に意図しない差分がないことを確認

- [x] フェーズ3のコミット作成
  - [x] 「lint/format スクリプトと開発環境設定を Biome に切り替え」としてコミット

## フェーズ4: 旧ツール関連の削除

- [x] `package.json` から旧依存を削除
  - [x] `eslint` を devDependencies から削除
  - [x] `eslint-config-next` を devDependencies から削除
  - [x] `prettier` を devDependencies から削除

- [x] 旧設定ファイルを削除
  - [x] `eslint.config.mjs` を削除
  - [x] `.prettierrc` を削除
  - [x] `.prettierignore` を削除

- [x] `package-lock.json` を再生成
  - [x] `npm install` を実行
  - [x] `package-lock.json` の差分を確認(`eslint*` / `prettier` 系が消えていること)
  - [x] `node_modules` を `npm ls eslint prettier` などで二重チェック(0 件であること)

- [x] フェーズ4のコミット作成
  - [x] 「ESLint / Prettier 関連の依存・設定を削除」としてコミット

## フェーズ5: ドキュメント更新

- [x] `docs/development-guidelines.md` を更新
  - [x] 「フォーマット規約」セクションの Prettier 設定表を Biome 設定表に置換
  - [x] 「ESLint基本方針」を「Biome lint 方針」にリネームし本文を更新
  - [x] 「CI/CDパイプライン > GitHub Actions」のサンプル YAML を更新(変更がなければそのまま)
  - [x] 「CI/CDパイプライン > npm scripts」のサンプルに `format` / `check` を追加
  - [x] セルフレビューチェックリストの `npm run lint` 言及を再確認(コマンド名は不変)

- [x] `docs/architecture.md` を更新
  - [x] 「開発ツール」表の `ESLint` / `Prettier` 行を `Biome` 1 行に統合(バージョン: `2.x`、用途: リンター + フォーマッター)
  - [x] 「依存関係管理 > バージョン管理方針」の `devDependencies` 例を更新
    - [x] `eslint` / `prettier` を削除
    - [x] `@biomejs/biome` を追加

- [x] フェーズ5のコミット作成
  - [x] 「開発ガイドライン / アーキテクチャドキュメントを Biome 前提に更新」としてコミット

## フェーズ6: 品質チェックと動作検証

- [x] ローカルでの全体検証
  - [x] `npx biome --version` が成功 (v2.4.14)
  - [x] `npm run lint` がエラーゼロで成功 (Checked 52 files in 30ms)
  - [x] `npm run format` 実行後 `git diff` が空(整形済みであることを確認)
  - [x] `npm run typecheck` が成功 (TypeScript: No errors found)
  - [x] `npm run build` が成功 (Next.js 15.5.15 compiled successfully in 2.3s)
  - [x] `npm run test:unit` が成功 (PASS 104 / FAIL 0)
  - [x] `npm run test:integration` が成功 (PASS 0 / FAIL 0、テストファイルなし)
  - [x] `npm run test:e2e` が成功 (PASS 5 / FAIL 0)

- [x] 成功指標の計測と記録
  - [x] 新 `biome lint .` の所要時間を計測 (3 回平均: ~50ms real / 8ms internal)
  - [x] 設定ファイル数の削減確認(3 → 1: `biome.json` のみ)
  - [x] devDependencies の削減確認(`eslint`/`eslint-config-next`/`prettier` の 3 件削除、`@biomejs/biome` 1 件追加)

- [x] CI(GitHub Actions) の動作確認
  - [x] feature ブランチへの push で CI が緑になることを確認 (PR #18: lint-and-typecheck / test / e2e / security 全て pass)
  - [x] `pull_request` トリガーを `branches: [main]` から `types: [opened, reopened, synchronize]` に変更して起動を回復(原因: PR が一度作成された後にトリガー条件を満たす push が認識されない既知の挙動)

## フェーズ7: PR 作成と最終確認

- [x] PR を作成
  - [x] タイトル: 「Linter / Formatter を Biome に移行」
  - [x] 本文に Issue #16 をリンク
  - [x] 本文に成功指標の計測結果を記載 (PR #18: https://github.com/kakikubo/lgtmhub/pull/18)

- [x] 振り返りを記録(このファイル下部の「実装後の振り返り」セクションを更新)

---

## 実装後の振り返り

### 実装完了日
2026-05-05

### 計画と実績の差分

**計画と異なった点**:
- `npx biome migrate eslint --write` が `eslint-config-next` の `@rushstack/eslint-patch` 経由のロードに失敗(ESLint v9 互換性問題)
  - 対処: `eslint.config.mjs` には独自ルール定義がなく、`ignores` は Prettier 移行で取り込み済みのため、ESLint マイグレーションは実行不要と判断してスキップ
- 既存コードに Biome `recommended` 違反が想定より多く検出された
  - `style/noNonNullAssertion` (8 warnings): `process.env.X!` の Supabase クライアント初期化パターン全体
  - `suspicious/noThenProperty` (1 error): Supabase クエリビルダーの thenable モック
  - 対処: `biome.json` でルール調整(前者は全体 off、後者は tests/** override)
- フェーズ 3 の devcontainer.json 編集後にフォーマット差分が出た
  - 対処: フェーズ 6 検証時に `biome format --write` で再整形し、追加コミット作成

**新たに必要になったタスク**:
- `biome.json` に linter ルール調整(`noNonNullAssertion` / `noThenProperty`) を追加
- devcontainer.json の Biome 整形に追従するコミットを追加

**技術的理由でスキップしたタスク**:
- `npx biome migrate eslint --write` の実行
  - スキップ理由: `eslint-config-next` が `@rushstack/eslint-patch` 経由で ESLint v9 と互換性なくロード時にクラッシュ
  - 代替実装: `eslint.config.mjs` のカスタムルール定義は元々ゼロ、ignores は Prettier マイグレーションで既に取り込み済みのため、自動マイグレーション不要と判断

### 学んだこと

**技術的な学び**:
- Biome v2.x は `biome migrate prettier --write` で `.prettierrc` + `.prettierignore` を一発で取り込める
- Biome のデフォルト `indentStyle` は `tab`(Prettier は spaces)、明示しないと既存コードと差分が出るので注意
- `files.includes`(top-level) で formatter / linter / assist の全機能に共通の ignore を適用できる
- `overrides[].includes` でディレクトリ単位のルール調整が可能
- `eslint-config-next` は `@rushstack/eslint-patch` 経由で ESLint 内部に介入するため、ESLint v9 + Biome の組み合わせでは migrate コマンドが機能しない

**プロセス上の改善点**:
- 整形コミット(フェーズ 2)を独立させる戦略がレビュー観点で有効: 24 ファイルの整形差分と設定変更を切り分けられた
- フェーズ別コミット運用により、`git log --oneline` でマイグレーションの全体像が追える
- 失敗ケース(`eslint migrate` の失敗)に対して design.md のリスク表が役立った: 即座に「`biome.json` を手書きで再構築」の代替方針に切り替えられた

### 成功指標の計測結果

- **lint 実行時間**: 新 `biome lint .` = 約 30〜50ms (real time, 3 回平均) / 内部処理 8ms
  - 旧 `next lint` の実測値はファイル削除済みのため未取得。一般的に Next.js + ESLint は同規模で 5〜15 秒程度
- **設定ファイル数**: 3 → 1 (`eslint.config.mjs` + `.prettierrc` + `.prettierignore` → `biome.json`)
- **devDependencies**: -3 (`eslint` / `eslint-config-next` / `prettier`) / +1 (`@biomejs/biome`) → 純減 2 件
- **`npm install` 後の node_modules**: `eslint*` / `prettier` 系パッケージが完全に消えていることを確認(関連の transitive deps も削除)

### 次回への改善提案
- ツール移行系のタスクでは「自動マイグレーションコマンドが失敗するケース」を design.md のリスク表に最初から含めておくと、判断が速い
- 整形コミットを独立させる運用は今後のフォーマッタ変更でも継続採用したい
- Biome v3 系登場時 / Oxfmt 1.0 stable 到達時には別 issue で再評価する余地がある(Tailwind 並び替えと Next.js 固有ルールが関心事)
