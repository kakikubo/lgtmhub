# 設計書

## アーキテクチャ概要

ビルド成果物や実行時の挙動には一切影響しない、lint ツールチェーンの追加。既存の Biome（JS/TS/JSON/CSS）に対して、Biome がサポートしない Markdown を markdownlint-cli2 で補完する構成にする。

```text
リポジトリの lint 体系

  Biome            ... *.{js,jsx,ts,tsx,json,jsonc,css}   (既存)
    ├─ pnpm run check    → CI: lint-and-typecheck
    └─ lefthook pre-commit (staged のみ、--write で自動修正)

  markdownlint-cli2 ... docs/**/*.md                      (今回追加)
    └─ pnpm run lint:md  → CI: lint-and-typecheck に同居
```

Biome と markdownlint は対象拡張子が排他なので、同じジョブに並べても競合しない。

## コンポーネント設計

### 1. `.markdownlint-cli2.jsonc`（新規）

**責務**:

- 検査対象パスを `docs/**/*.md` に限定する
- 採用するルールと、無効化するルールおよびその理由を一元管理する
- CI と CodeRabbit の両方が読む唯一の正とする

**実装の要点**:

- `globs` に `docs/**/*.md` を書くことで、`pnpm run lint:md` は引数なしで実行できる
- CodeRabbit は markdownlint-cli2 をリポジトリ設定付きで実行するため、同じファイルが効く
- 形式は JSONC を選ぶ。無効化理由をコメントで残せることが必須要件（`.markdownlint.json` ではコメントが書けない）

**ルール採否の方針（「MD040 中心の最小構成」）**:

1. MD040 を有効にする（本 issue の目的）
2. 現状の `docs/` で違反 0 のルールはデフォルトのまま有効にする（将来の劣化を防げて、かつ今回の修正が増えない）
3. コードフェンスと無関係な違反が出るルールは、理由コメント付きで無効化する。散文を機械的に書き換えて可読性を落とさないため

MD040 を直した状態で `markdownlint-cli2` を走らせた結果、403 件の違反（MD040 は 0 件）が出た。内訳と処置は以下の通り確定した。

| ルール | 違反数 | 処置 | 理由 |
|---|---|---|---|
| MD060（表のパイプ間隔） | 230 | 無効化 | `docs/` の表は列幅を詰めた記法で統一されており、全面的な書式変更になる |
| MD032（リスト前後の空行） | 104 | 無効化 | 見出し直後や説明行直後に空行なしでリストを続ける書き方が全体で一貫している |
| MD031（フェンス前後の空行） | 30 | 無効化 | 同上 |
| MD022（見出し前後の空行） | 18 | 無効化 | 同上 |
| MD034（裸の URL） | 11 | 無効化 | `glossary.md` の「公式サイト」欄など。GitHub 側で自動リンクされるため実害なし |
| MD058（表前後の空行） | 4 | 無効化 | 同上 |
| MD012（連続する空行） | 3 | 無効化 | 区切りとして意図的に 2 行空けている箇所がある |
| MD028（引用内の空行） | 1 | 無効化 | `product-requirements.md` の引用の書き方 |
| MD013（行長） | （多数） | 無効化 | 4792 行中 264 行が 80 文字超、最長 612 行。日本語の散文で機械的な折り返しは可読性を損なう |
| MD024（重複見出し） | 2 | `siblings_only: true` | `functional-design.md` の `### 目的` / `### 処理フロー` は異なる親見出し配下の兄弟セクション。完全無効化はしない |
| MD051（リンクフラグメント） | 2 | **docs を修正** | `glossary.md` の `[RLS](#rls-row-level-security)` が実在しない見出しを指していた（実際の見出しは `### RLS`）。書式の好みではなく壊れたリンクなので直し、ルールは有効のまま残す |

無効化したルールのうち MD060 / MD032 / MD031 / MD022 / MD058 / MD012 / MD028 は `--fix` で自動修正できる。しかし `docs/` 全体に約 400 箇所の空白・改行の変更が入り、「コードフェンスの言語指定」とは別の関心事（書式の一括整形）になるため、本 PR では扱わず設定で無効化するに留める。有効化するなら独立した PR で行う。

### 2. `package.json`（変更）

**責務**: Markdown lint の実行口を提供する

**実装の要点**:

- `devDependencies` に `markdownlint-cli2` を追加する。実行時には使わないため dev 側で確定（#283 と同じ判断基準）
- スクリプト名は `lint:md`。既存慣習は `lint` / `format` / `check`（いずれも Biome 専用）＋ `:` 区切りのサブコマンド（`test:unit` 等）なので、`lint:md` が整合する
- `check`（Biome の lint + format）には合流させない。`check` は「Biome を正とする」という既存の記述があり、意味を混ぜない

### 3. `.github/workflows/ci.yml`（変更）

**責務**: PR で Markdown の劣化を止める

**実装の要点**:

- 新規ジョブを立てず、既存 `lint-and-typecheck` ジョブに `- run: pnpm run lint:md` を 1 ステップ追加する
- 理由: 別ジョブにすると checkout + pnpm setup + `pnpm install --frozen-lockfile` が丸ごともう一度走り、数十秒の検査のために 1 分以上の固定コストを払うことになる。lint 系のゲートという意味づけも `lint-and-typecheck` と同一
- ジョブ名は変更しない（ブランチ保護の required check 名を壊さないため）
- `timeout-minutes: 10` は据え置き

### 4. `docs/` 配下 6 ファイル（変更）

**責務**: MD040 違反の解消

**実装の要点**:

- 開始フェンス 33 箇所にタグを付けるだけ。**ブロックの中身と閉じフェンスには一切触れない**
- 付けるタグは `text` 32 箇所 / `gitignore` 1 箇所
- 素のフェンスの中に `bash` / `json` / `sql` / `typescript` 相当のものは 1 つも無い。シェルコマンドやコードは既にすべてタグ付きで書かれており、タグ漏れは「図・ツリー・一覧・テンプレート」系に集中している

### 5. `docs/development-guidelines.md`（追記）

**責務**: ツールチェーンの記述と実態の一致

**実装の要点**:

- 「フォーマット規約」節に Markdown lint の項を追加する。同節には現在「Linter / Formatter は Biome 1 本に統一」「lefthook の対象拡張子: Biome がサポートする拡張子のみ」とあり、そのままでは今回の追加と矛盾するため、Biome が Markdown を扱わないことを明示したうえで補完関係として書く
- 「CI/CD パイプライン > GitHub Actions」に Markdown lint の記述とサンプル YAML への反映を行う
- 「package.json scripts」の転記一覧に `lint:md` を追加する

## データフロー

### PR 作成時

```text
1. 開発者が docs/*.md を編集して push
2. CI: lint-and-typecheck ジョブ
   → pnpm run check      (Biome: JS/TS/JSON/CSS)
   → pnpm run typecheck  (tsc)
   → pnpm run lint:md    (markdownlint-cli2: docs/**/*.md)
3. MD040 違反があればジョブが失敗し、PR がマージできない
4. CodeRabbit も同じ .markdownlint-cli2.jsonc を読むため、指摘内容が CI と一致する
```

### ローカル実行

```text
pnpm run lint:md          → 検査のみ
pnpm exec markdownlint-cli2 --fix   → 自動修正（MD040 は自動修正不可）
```

MD040 は「どの言語タグが正しいか」を機械が決められないため `--fix` の対象外。人が判断して付ける。

## エラーハンドリング戦略

lint ツールの導入のため、アプリケーションのエラーハンドリングには影響しない。

CI 側の失敗の扱い:

- `markdownlint-cli2` は違反があれば非 0 終了し、ジョブが失敗する（`continue-on-error` は付けない）
- 警告として見逃す運用にはしない。ゲートとして機能しないと再発防止にならないため

## テスト戦略

### ユニットテスト

新規のアプリケーションコードが無いため、追加しない。

### 検証（自動テストの代わり）

- `pnpm run lint:md` がエラー 0 で終了すること
- 意図的に言語指定なしフェンスを一時追加すると検査が失敗することを確認し、ゲートとして機能していることを証明する（確認後に元へ戻す）
- 既存の `pnpm run check` / `typecheck` / `test` / `build` に影響が無いこと

## 依存ライブラリ

```json
{
  "devDependencies": {
    "markdownlint-cli2": "^0.19.0"
  }
}
```

実際に追加されたのは `markdownlint-cli2@0.23.2`（CodeRabbit が使っているものと同じバージョン）。

**推移依存の脆弱性対応（計画外）**: `markdownlint-cli2@0.23.2` は `smol-toml` を `1.7.0` に**固定ピン**しており、これが GHSA-7w5x-hrqm-74c2（不正な TOML による DoS、patched `>=1.7.1`）に該当する。そのままでは CI の `security` ジョブ（`pnpm audit --audit-level high`）が落ちる。固定ピンのため依存側を上げても解消しないので、既存の postcss / sharp / fast-uri / brace-expansion と同じく `pnpm-workspace.yaml` の `overrides` で引き上げる。

```yaml
overrides:
  smol-toml: ^1.7.1 # 不正な TOML による DoS (GHSA-7w5x-hrqm-74c2)。markdownlint-cli2 が 1.7.0 を固定ピンしている
```

本プロジェクトの markdownlint 設定は JSONC であり TOML パーサーは実行経路に乗らないが、`pnpm audit` は到達可能性を見ないため override が必要。

## ディレクトリ構造

```text
.markdownlint-cli2.jsonc                      # 新規
package.json                                  # devDep + lint:md スクリプト
pnpm-lock.yaml                                # 上記に伴う更新
.github/workflows/ci.yml                      # lint-and-typecheck にステップ追加
docs/architecture.md                          # フェンス 2 箇所
docs/development-guidelines.md                # フェンス 8 箇所 + 方針追記
docs/functional-design.md                     # フェンス 11 箇所
docs/glossary.md                              # フェンス 2 箇所
docs/repository-structure.md                  # フェンス 10 箇所
.steering/20260920-issue-307-markdownlint-ci/ # 本ステアリング
```

## 実装の順序

1. `docs/` のフェンス 33 箇所に言語タグを付ける
2. `markdownlint-cli2` を devDependency に追加する
3. `.markdownlint-cli2.jsonc` を作成し、実行結果を見ながら無効化ルールを確定する
4. `package.json` に `lint:md` を追加する
5. `ci.yml` にステップを追加する
6. `docs/development-guidelines.md` に方針を追記する
7. 全検証コマンドを実行する

先にフェンスを直してから設定を入れる順序にする理由は、設定を先に入れると「MD040 で 33 件落ちる」状態を一度作ることになり、無効化すべき他ルールの違反が MD040 の大量出力に埋もれるため。

## セキュリティ考慮事項

- `markdownlint-cli2` は devDependency のため本番バンドルに入らない
- 新規依存の追加になるため、CI の `security` ジョブ（`pnpm audit --audit-level high`）が通ることを確認する

## パフォーマンス考慮事項

- `lint-and-typecheck` ジョブに同居させるため、CI の追加コストは markdownlint の実行時間（`docs/` 8 ファイルで 1 秒未満の見込み）のみ。ジョブ追加に伴う固定コスト（checkout / pnpm setup / install）は発生しない

## 将来の拡張性

- 適用範囲を広げる場合は `.markdownlint-cli2.jsonc` の `globs` に対象を足すだけで済む。候補は `README.md`（3 箇所）→ `.claude/`（31 箇所）→ `.steering/`（113 箇所）の順
- `.steering/` は作業単位の履歴ドキュメントで件数が多いため、広げるなら最後に判断する
