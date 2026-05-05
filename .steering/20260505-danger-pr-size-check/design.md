# 設計: Danger による PR 変更行数チェック

## 採用方針

- **Danger 実装**: [`danger-js`](https://danger.systems/js/) を採用する。理由は Node.js / TypeScript プロジェクトなので追加 ranger（Ruby）を入れる必要がない、`npm` で完結するため。
- **配置**: ルート直下の `dangerfile.ts` に Danger スクリプトを置く。danger-js の慣例に合わせる。
- **CI workflow**: 既存の `ci.yml` には載せず、独立した `.github/workflows/danger.yml` を新設する。理由:
  - 既存 CI ジョブに比べて Danger は外部 API（GitHub API）に書き込む副作用ジョブのため、責務を分離したい。
  - 万一 Danger が落ちても lint/test/e2e の結果に影響しないようにしたい。

## ファイル構成

```
.github/workflows/
  danger.yml          # 新規: pull_request 時に Danger を実行
dangerfile.ts          # 新規: PR サイズ判定ロジック
package.json           # 更新: devDependency に danger を追加
docs/
  development-guidelines.md  # 更新: 自動チェック導入を追記
```

## dangerfile.ts の責務

`danger.git.created_files` と `danger.git.modified_files` から、

1. プロダクションコード対象（`app/` `src/` `components/`）に絞り込み、
2. 除外パターン（`tests/`、`src/types/database.types.ts`、`package-lock.json`、`supabase/migrations/`）を弾き、
3. 残ったファイル群について `danger.git.diffForFile()` で追加行＋削除行を集計し、
4. 閾値超過なら `warn()` を出す。

### 計測単位

`docs/development-guidelines.md` の例（`git diff --stat`）と整合させ、**追加行 + 削除行** の合計で判定する。

`danger.git.diffForFile(file)` が返す `{ added, removed }` の各文字列を改行で分割した行数を加算する。空文字列のときは 0 行扱い。

### 閾値

- 行数閾値: 300（`LINE_THRESHOLD`）
- ファイル数閾値: 10（`FILE_THRESHOLD`）

定数として宣言し、ガイドライン側の定数と乖離が起きたら一目で分かるようにする。

### 警告メッセージ

日本語。各 warning に以下を含める:

- 実測値 / 閾値
- 「ガイドラインの目安であり、PR 説明欄に理由を書けば例外可」である旨
- ガイドラインへのリンク（リポジトリ相対パス: `docs/development-guidelines.md` の「PRの大きさの目安」）

例:

> プロダクションコード（`app/` `src/` `components/`）の追加・変更行数が **412 行** で、推奨上限 300 行を超えています。分割を検討してください。例外的に大きい PR の場合は PR 説明欄に理由を記載してください。詳細: [`docs/development-guidelines.md`](../../docs/development-guidelines.md) の「PRの大きさの目安」。

## .github/workflows/danger.yml

- トリガー: `pull_request`（types: opened, reopened, synchronize, edited）
- 権限: `pull-requests: write`、`contents: read`、`issues: write`
- ステップ:
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4`（Node 24, npm cache）
  3. `npm ci`
  4. `npx danger ci`（環境変数 `GITHUB_TOKEN` に `secrets.GITHUB_TOKEN` を渡す）

`fork` からの PR は Danger CI が GITHUB_TOKEN の権限不足で失敗する仕様。MVP では本リポジトリは社内寄りでフォーク運用ではないため、対応はスコープ外。

## ガイドラインドキュメントの更新

`docs/development-guidelines.md` の「PRの大きさの目安」に「自動チェック」のサブセクションを追記:

- どのワークフローで動くか
- どんなときに warning が出るか
- 例外運用（PR 説明欄に理由を書けばスルー）

## 検証方針

- ローカルでの完全再現は難しいため、CI 上での動作確認を主とする。
- 静的検証として:
  - `npm install` が通ること
  - `npm run lint`（biome）が通ること
  - `npm run typecheck`（tsc --noEmit）が通ること（dangerfile.ts も対象に入る）
  - 既存テスト（`npm test`）が通ること
- 動的検証は、本 PR がそのまま新ワークフローのスモークテストになる。実際に warning コメントが付くか PR で確認する。

## トレードオフ / 選択しなかった案

- **`actions/github-script` で軽量に実装**: スクリプトはシンプルになるが、Danger には diff 集計ヘルパーや `warn`/`fail`/`message` の使い分け、結果の単一コメント集約などが備わっており、将来 PR タイトル / 説明欄ルール（issue 1PR=1関心事）追加でも転用できる。Danger を選択。
- **dangerfile.js（プレーン JS）**: 採用するとセットアップが簡単。だが本リポジトリは TypeScript 6 を採用しており、tsc 対象に揃えたほうが整合する。`.ts` を採用。
- **行数を「追加行のみ」で集計する案**: わかりやすいが、ガイドライン側の例（`git diff --stat`）が insertions+deletions を表示するので合わせる。
