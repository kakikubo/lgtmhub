# タスクリスト: ci.yml に permissions と concurrency を設定する (Issue #382)

## フェーズ1: 実装

- [x] `ci.yml` にトップレベル `permissions: contents: read` を追加
- [x] `ci.yml` に `concurrency`（PR は ref 単位でキャンセル、push は run_id 単位）を追加
- [x] `docs/development-guidelines.md` の GitHub Actions 節に権限と concurrency の方針を追記

## フェーズ2: 検証

- [x] actionlint で `ci.yml` を検証（新規指摘なし。既存 `run` の SC2129 style 指摘のみで本件の範囲外）
- [x] lint:md / check / typecheck / test をローカルで実行（lint:md 0 issues、biome 473 files、tsc エラーなし、vitest 512 passed）
- [x] PR 上で CI の全ジョブが成功することを確認（PR #413: lint-and-typecheck / test / e2e / security と codecov/patch・project がすべて pass）

## 実装後の振り返り

### 実装完了日

2026-11-03

### 計画と実績の差分

- concurrency は Issue 記載案（`ci-${{ github.ref }}` + PR のみ cancel）から変更した。main では同一グループに pending を 1 つしか置けず、連続マージで中間コミットの run が取り消されるため、push は `run_id` でグループを分けた
- implementation-validator は必須修正なしだった。ただし「tokenless の Codecov は `pull-requests: read` が要るかもしれない」という指摘があった。Codecov step は `fail_ci_if_error: false` でゲートにしていないため、PR 上の run で Codecov のステータスが出るかを確認する

### 学んだこと

- `concurrency` は `cancel-in-progress: false` でも同一グループの pending run を置き換える。「キャンセルしない」には別グループにする必要がある

### 次回への改善提案

- workflow を新規作成するときは、`permissions` と `concurrency` を最初から書く
