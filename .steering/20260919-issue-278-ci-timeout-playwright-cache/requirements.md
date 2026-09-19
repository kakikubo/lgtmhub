# 要求内容

## 概要

全 GitHub Actions ジョブに `timeout-minutes` を設定し、e2e ジョブの Playwright ブラウザを `actions/cache` でキャッシュする。ハング時の Runner 浪費を止め、Chromium ダウンロードを省略して e2e を短くする。

## 背景

`.github/workflows/` 配下の全ワークフロー・全ジョブに `timeout-minutes` がない。ハングしたジョブは GitHub Actions のデフォルト上限（6 時間）まで走り続け、Runner 時間を浪費する。特に e2e（Supabase Docker 起動 + Playwright）はハングしやすい。

加えて e2e は毎回 `pnpm exec playwright install --with-deps chromium` で Chromium をダウンロードしている。ブラウザ本体は `~/.cache/ms-playwright` に置かれるため、`actions/cache` で再利用できる。

参照: GitHub Issue [#278](https://github.com/kakikubo/lgtmhub/issues/278)

## 実装対象の機能

### 1. 全ジョブへの timeout-minutes
- `runs-on` を持つジョブと、再利用ワークフローを呼ぶジョブの両方に設定する
- 値は実測の 2〜3 倍を下限とし、Issue の目安に合わせる
  - lint-and-typecheck / test / security / その他: 10 分
  - e2e: 20 分

### 2. Playwright ブラウザのキャッシュ
- e2e ジョブで `~/.cache/ms-playwright` を `actions/cache` する
- キャッシュキーは OS と `pnpm-lock.yaml` のハッシュにする（Playwright 更新で自動無効化）
- OS パッケージはキャッシュできないため、ヒット時は `playwright install-deps chromium` のみ実行する

### 3. ガイドラインの追随
- `docs/development-guidelines.md` の CI サンプルと説明を実態に合わせる

## 受け入れ条件

### 全ジョブへの timeout-minutes
- [x] `.github/workflows/` 配下の全ジョブに `timeout-minutes` がある
- [x] lint-and-typecheck / test / security は 10 分、e2e は 20 分である
- [x] Danger / Release Drafter / Supabase Push（本体と呼び出し側）も 10 分である

### Playwright ブラウザのキャッシュ
- [x] e2e ジョブが `~/.cache/ms-playwright` を `actions/cache` する
- [x] キャッシュミス時は `playwright install --with-deps chromium` を実行する
- [x] キャッシュヒット時は `playwright install-deps chromium` のみ実行する

### ガイドラインの追随
- [x] `docs/development-guidelines.md` が timeout と Playwright キャッシュを説明している

## 成功指標

- ハングしたジョブは設定時間で打ち切られ、6 時間走らない
- 2 回目以降の e2e（キャッシュヒット時）で Chromium ダウンロードが省略される

## スコープ外

以下はこのフェーズでは実装しません:

- Docker レイヤーや Supabase イメージのキャッシュ
- e2e 以外のジョブへの `actions/cache` 追加（pnpm は `setup-node` の `cache: pnpm` 済み）
- timeout 値の動的算出や workflow レベルの timeout

## 参照ドキュメント

- `docs/development-guidelines.md` - CI/CDパイプライン
- GitHub Issue [#278](https://github.com/kakikubo/lgtmhub/issues/278)
