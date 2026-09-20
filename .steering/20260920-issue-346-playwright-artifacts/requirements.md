# 要求内容

## 概要

CI の e2e ジョブで Playwright の HTML レポートと test-results（trace）をアーティファクトとして保存し、失敗時に stdout 以外の調査材料を残す。

## 背景

`.github/workflows/ci.yml` の e2e ジョブに `playwright-report` / `test-results` のアーティファクト upload がない。CI で e2e が落ちたとき、調査できるのは stdout のログだけで、trace・HTML レポートが失われる。

`playwright.config.ts` は `trace: 'on-first-retry'` かつ CI で `retries: 2` なので、リトライ時には trace が生成されている。捨てているだけである。

Issue #279 (PR #344) で e2e をシードデータ前提の無条件アサートに変えた結果、これまで skip されて緑だったテストが実際に走るようになった。落ちたときに原因を追える状態を整えておきたい。

参照: GitHub Issue [#346](https://github.com/kakikubo/lgtmhub/issues/346)

## 実装対象の機能

### 1. e2e ジョブのアーティファクト upload
- `actions/upload-artifact` で `playwright-report/` と `test-results/` を上げる
- `if: always()`（失敗時にこそ必要なため）
- `retention-days` は 7 日
- 対象パスを上記 2 ディレクトリに絞る

### 2. ガイドラインの追随
- `docs/development-guidelines.md` の CI 説明とサンプル YAML を実態に合わせる

## 受け入れ条件

### e2e ジョブのアーティファクト upload
- [x] e2e ジョブが `if: always()` で `playwright-report/` と `test-results/` を upload する
- [x] `retention-days` が 7 である
- [x] 対象パスが上記 2 ディレクトリに限定されている

### ガイドラインの追随
- [x] `docs/development-guidelines.md` が e2e アーティファクト保存を説明している

## 成功指標

- PR の Actions Summary から `playwright-report` をダウンロードできる
- 成功時のジョブ時間が目に見えて延びない

## スコープ外

以下はこのフェーズでは実装しません:

- `screenshot` / `video` の有効化（現状 `screenshot` は未設定で既定 `off`）
- 失敗専用のダミー e2e 追加（本 PR を赤にしない）
- ジョブ権限ブロックの追加

## 参照ドキュメント

- `docs/development-guidelines.md` - CI/CDパイプライン
- GitHub Issue [#346](https://github.com/kakikubo/lgtmhub/issues/346)
