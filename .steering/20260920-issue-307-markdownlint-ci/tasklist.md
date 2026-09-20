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

## フェーズ1: docs のコードフェンスに言語指定を付ける

対象は言語指定なしの**開始**フェンス 33 箇所のみ。閉じフェンスとブロックの中身には触れない。

- [x] `docs/architecture.md`（2 箇所）
  - [x] L42 レイヤー構成図 → `text`
  - [x] L80 依存方向の矢印図 → `text`

- [x] `docs/glossary.md`（2 箇所）
  - [x] L434 レイヤー依存の矢印図 → `text`
  - [x] L807 ハミング距離の疑似数式 → `text`（実行可能コードではないため `python` は付けない）

- [x] `docs/functional-design.md`（11 箇所）
  - [x] L215 / L253 / L290 / L334 / L361 / L405 / L439 / L459 / L505 API シグネチャ表記 → `text`
  - [x] L704 画像登録フォームの UI モックアップ → `text`
  - [x] L728 `app/` 配下のディレクトリツリー → `text`

- [x] `docs/development-guidelines.md`（8 箇所）
  - [x] L492 / L498 Vercel Preview の Redirect URL パターン → `text`
  - [x] L535 ブランチ戦略ツリー → `text`
  - [x] L550 / L560 / L568 コミットメッセージのテンプレートと実例 → `text`
  - [x] L587 良い PR / 混在 PR の対比リスト → `text`
  - [x] L637 テストピラミッドの ASCII アート → `text`

- [x] `docs/repository-structure.md`（10 箇所）
  - [x] L9 リポジトリ全体のディレクトリツリー → `text`
  - [x] L223 呼び出しフローの矢印 → `text`
  - [x] L255 `src/services/` のファイル一覧 → `text`
  - [x] L379 `tests/` ディレクトリツリー → `text`
  - [x] L493 レイヤー依存図 → `text`
  - [x] L556 / L568 / L581 / L589 P1 追加予定ファイル一覧 → `text`
  - [x] L628 `.gitignore` の転記 → `gitignore`

- [x] 言語指定なしの開始フェンスが `docs/` に 0 箇所であることをスクリプトで確認

## フェーズ2: markdownlint の導入

- [x] `markdownlint-cli2` を devDependencies に追加
- [x] `.markdownlint-cli2.jsonc` を作成
  - [x] `globs` を `docs/**/*.md` に限定
  - [x] MD013 を無効化（理由コメント付き）
  - [x] MD024 に `siblings_only: true` を設定（理由コメント付き）
  - [x] 実行して出た残りの違反を確認し、無効化するか docs を直すかを判断して確定
- [x] `package.json` に `lint:md` スクリプトを追加
- [x] `pnpm run lint:md` がエラー 0 で通ることを確認

## フェーズ3: CI への組み込み

- [x] `.github/workflows/ci.yml` の `lint-and-typecheck` ジョブに `pnpm run lint:md` ステップを追加
- [x] 言語指定なしフェンスを一時的に足すと検査が落ちることを確認し、ゲートとして機能していることを証明する（確認後に元へ戻す）

## フェーズ4: 品質チェックと修正

- [x] `pnpm install --frozen-lockfile` が通ることを確認
- [x] `pnpm run check`（Biome）
- [x] `pnpm run typecheck`
- [x] `pnpm run test`
- [x] `pnpm run build`
- [x] `pnpm audit --audit-level high`（新規依存の追加があるため）
- [x] **（計画外・追加）** `smol-toml` の GHSA-7w5x-hrqm-74c2 を `pnpm-workspace.yaml` の `overrides` で解消
  - [x] `markdownlint-cli2@0.23.2` が `smol-toml@1.7.0` を固定ピンしており audit が high で落ちることを確認
  - [x] `smol-toml: ^1.7.1` を overrides に追加（既存の postcss / sharp / fast-uri / brace-expansion と同じ方式）
  - [x] 1.8.0 に解決された状態で `pnpm run lint:md` と `pnpm audit --audit-level high` が通ることを確認

## フェーズ5: ドキュメント更新

- [x] `docs/development-guidelines.md`「フォーマット規約」に Markdown lint の項を追加
  - [x] Biome が Markdown を扱わないこと、markdownlint がそれを補完する関係を明示
  - [x] 適用範囲が `docs/` のみであること、lefthook 対象外であることを記載
- [x] `docs/development-guidelines.md`「CI/CD パイプライン > GitHub Actions」に Markdown lint の記述とサンプル YAML の反映
- [x] `docs/development-guidelines.md`「package.json scripts」の一覧に `lint:md` を追加
- [x] **（計画外・追加）** `docs/repository-structure.md` のルート構成ツリーと設定ファイル一覧に `.markdownlint-cli2.jsonc` を追加
- [x] 追記後に再度 `pnpm run lint:md` が通ることを確認
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日

2026-09-20

### 計画と実績の差分

**計画と異なった点**:

- **issue 記載の箇所数が誤っていた**。issue #307 の「素の ``` フェンス 135 箇所」は `grep -c '^```$'`（言語指定なしの開始フェンス + すべての閉じフェンス）の値で、実際の修正対象は **33 箇所**だった。着手前にフェンスの開閉を追跡して数え直したため、作業量の見積りが大きく外れずに済んだ
- 素のフェンスの中に `bash` / `json` / `sql` / `typescript` 相当のものは 1 つも無く、32 箇所が `text`、1 箇所が `gitignore` で終わった。issue の対応案は「シェルコマンド → `bash`」などを想定していたが、コードやコマンドは既に全てタグ付きで書かれていた

**新たに必要になったタスク**:

- `smol-toml` の脆弱性対応（GHSA-7w5x-hrqm-74c2）。`markdownlint-cli2@0.23.2` が `smol-toml` を `1.7.0` に固定ピンしており、CI の `security` ジョブが落ちる状態だった。`pnpm-workspace.yaml` の `overrides` で `^1.7.1` に引き上げて解消。既存の postcss / sharp / fast-uri / brace-expansion と同じ対処
- `glossary.md` の壊れたアンカーリンク 2 箇所の修正。MD051 が `[RLS](#rls-row-level-security)` を検出したが、実際の見出しは `### RLS` だった。書式の好みではなく実際に飛べないリンクだったため直し、MD051 は有効なまま残した
- `docs/repository-structure.md` への `.markdownlint-cli2.jsonc` の追記。設定ファイル一覧とルート構成ツリーの両方に載っている形式だったため、記述と実態の一致を保つために追加

**技術的理由でスキップしたタスク**: なし

### 学んだこと

**技術的な学び**:

- `grep -c '^```$'` はコードフェンスの数え方として誤り。閉じフェンスは常に言語指定を持たないため、開始フェンスだけを数えるにはフェンスの開閉状態を追跡する必要がある
- markdownlint-cli2 0.23.2（markdownlint 0.41.1）には MD060（表のパイプ前後のスペース）という比較的新しいルールがあり、既存の詰めた表記法だと一気に 230 件の違反が出る
- MD040 は `--fix` の対象外。どの言語タグが正しいかは機械が決められないため
- 新しい devDependency を足すときは `pnpm audit --audit-level high` まで回さないと CI の `security` ジョブで初めて気づくことになる。固定ピンされた推移依存は `overrides` でしか剥がせない

**プロセス上の改善点**:

- ルールを「有効にして docs を直す」か「無効化する」かの判断基準を、違反数と関心事の切り分けで決めた。自動修正できるものでも約 400 箇所の書式変更になるものは、本 PR の関心事（コードフェンスの言語指定）とは別として設定で無効化し、別 PR の候補として design.md に残した

### 次回への改善提案

- issue 本文に数値が書かれていても、着手前に自分で数え直す。特に grep のワンライナーで出した数値は前提条件を確認する
- lint ツールを新規導入するときは「設定ファイルを置く」こと自体に価値がある。設定が無いと CodeRabbit のようなレビューツールがデフォルトルールで指摘し続け、プロジェクトの意思が反映されない
- 無効化したルールのうち自動修正可能なもの（MD060 / MD032 / MD031 / MD022 / MD058 / MD012 / MD028）は、書式の一括整形 PR として別途起票する価値がある
