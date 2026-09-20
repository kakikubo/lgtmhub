# 要求内容

## 概要

`docs/` 配下の Markdown コードフェンスに言語指定を付け切り、markdownlint のルールを設定ファイルで明文化したうえで、CI の lint ゲートに Markdown 検査を組み込む。

## 背景

#282 対応の PR #305 レビューで CodeRabbit（markdownlint-cli2）が MD040（`fenced-code-language`）を指摘した。指摘自体は妥当だが、当該 PR が触れた 4 箇所だけ直すと同一ファイル内で不統一になるため、独立した対応として issue #307 に切り出された。

現状リポジトリには markdownlint の設定ファイルが存在せず、CI でも Markdown を検査していない。そのため CodeRabbit は **markdownlint のデフォルトルールセット**をそのまま適用しており、プロジェクトとしてどのルールを採用するかの意思決定自体が未了だった。設定ファイルを置けば CodeRabbit と CI が同じルールを読むようになり、レビュー指摘のブレが止まる。

### issue 記載の箇所数の訂正

issue #307 本文の「素の ``` フェンス 135 箇所」は **開始フェンスの数ではない**。`grep -c '^```$'` の結果（＝言語指定なしの開始フェンス + すべての閉じフェンス）を転記したものと見られる。

フェンスの開閉を追跡して数え直した実測値は以下の通り:

| ファイル | 開始フェンス総数 | 言語指定なしの開始フェンス |
|---|---|---|
| `docs/functional-design.md` | 37 | 11 |
| `docs/repository-structure.md` | 13 | 10 |
| `docs/development-guidelines.md` | 37 | 8 |
| `docs/architecture.md` | 4 | 2 |
| `docs/glossary.md` | 14 | 2 |
| `docs/product-requirements.md` | 0 | 0 |
| `docs/ideas/*.md` | 0 | 0 |
| **合計** | **105** | **33** |

**実際の修正対象は 33 箇所**であり、135 箇所ではない。

## 実装対象の機能

### 1. docs のコードフェンスへの言語指定付与

- `docs/` 配下の言語指定なし開始フェンス 33 箇所すべてに言語タグを付ける
- 32 箇所は `text`（ディレクトリツリー、レイヤー依存図、UI モックアップ、コミットメッセージのテンプレート、API シグネチャ表記、ファイル一覧）
- 1 箇所は `gitignore`（`docs/repository-structure.md` の `.gitignore` 転記ブロック）

### 2. markdownlint 設定ファイルの追加

- `.markdownlint-cli2.jsonc` をリポジトリルートに新規作成する
- 検査対象は `docs/**/*.md` に限定する
- 既存ドキュメントの実態に合わないルールは理由付きで明示的に無効化する
- CodeRabbit も同じ設定ファイルを読むため、CI とレビューでルールが一致する

### 3. CI への Markdown lint 組み込み

- `pnpm run lint:md` スクリプトを追加する
- `ci.yml` の `lint-and-typecheck` ジョブに検査ステップを追加する

### 4. ドキュメント更新

- `docs/development-guidelines.md` の「フォーマット規約」「CI/CD パイプライン」「package.json scripts」に markdownlint の方針を追記する

## 受け入れ条件

### docs のコードフェンス

- [ ] `docs/` 配下に言語指定なしの開始フェンスが 0 箇所であること
- [ ] 既存のタグ付きフェンス（`typescript` 42 / `json` 14 / `mermaid` 5 / `bash` 5 ほか）を書き換えていないこと
- [ ] コードブロックの中身自体を変更していないこと

### markdownlint 設定

- [ ] `pnpm run lint:md` が `docs/` に対してエラー 0 で通ること
- [ ] 無効化した各ルールに、無効化理由がコメントとして書かれていること

### CI

- [ ] `ci.yml` の `lint-and-typecheck` ジョブで Markdown lint が実行されること
- [ ] CI が green であること

### 既存の検証コマンド

- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` / `pnpm run build` が通ること

## 成功指標

- `docs/` の MD040 違反が 33 → 0 になる
- markdownlint 設定ファイルが存在することで、CodeRabbit のデフォルトルールによる想定外の指摘が止まる
- 今後 `docs/` に言語指定なしフェンスが追加されると CI が落ちる（再発防止）

## スコープ外

以下はこのフェーズでは実装しません:

- `README.md`（素のフェンス 3 箇所）、`AGENTS.md`、`CLAUDE.md` 系、`.claude/` 配下（31 箇所）、`.steering/` 配下（113 箇所）への適用。適用範囲は `docs/` のみとする方針決定済み
- `ts` → `typescript` の表記ゆれ統一（60 箇所、すべて `.steering/` 配下でスコープ外）
- lefthook（pre-commit）への markdownlint 追加。`lefthook.yml` は staged ファイルを直接渡す方式のため、`.markdownlint-cli2.jsonc` の `globs` による対象限定が効かず、スコープ外のファイルまで検査してしまう
- `renovate.json` への markdownlint 専用 `groupName` 追加

## 参照ドキュメント

- `docs/development-guidelines.md` - 開発ガイドライン（フォーマット規約 / CI/CD パイプライン）
- `docs/repository-structure.md` - リポジトリ構造定義書
- `.coderabbit.yaml` - CodeRabbit 設定（現状 `language` と `reviews.profile` のみ）
