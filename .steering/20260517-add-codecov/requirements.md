# 要求内容

## 概要

リポジトリに Codecov を導入し、テストカバレッジを CI で計測・アップロードして、PR および main マージ時にカバレッジ状況が可視化される状態にする。

## 背景

- `@vitest/coverage-v8` は既に devDependencies に存在し、`vitest.config.ts` には `coverage` 設定 (provider: v8, reporter: text/json/html, services 90% / lib 80% の threshold) がある
- `package.json` に `test:coverage` (`vitest run --coverage`) スクリプトも既にある
- しかし CI (`.github/workflows/ci.yml` の `test` ジョブ) はカバレッジを計測しておらず (`npm run test:unit` + `npm run test:integration` のみ)、カバレッジ結果は CI 上でもどこにも残らない
- そのため「PR でどの程度カバーされているか」「main のカバレッジ推移」が誰にも見えない
- ユーザー要望: **CI で結果が参照でき、PR や main マージ時にどのくらいカバレッジされているか分かるようにしたい**

## 実装対象の機能

### 1. CI でカバレッジを計測

- `.github/workflows/ci.yml` の `test` ジョブで、分割していた `test:unit` + `test:integration` を `test:coverage` (= `vitest run --coverage`、e2e 以外の全テストを 1 パスでカバレッジ計測) に置き換える
- `postgres` service は `test` ジョブに既存のため、将来 integration テストが追加されても文脈は変わらない

### 2. Codecov へアップロード

- `codecov/codecov-action@v5` で `coverage/lcov.info` を Codecov にアップロードするステップを `test` ジョブに追加
- `test` ジョブは `push: [main]` と `pull_request` 両方で走るため、PR・main 双方のカバレッジが Codecov に送られる
- public リポジトリのため token なし (tokenless) でも動作するが、`CODECOV_TOKEN` secret があれば優先利用する。アップロード失敗で CI を落とさない (`fail_ci_if_error: false`)

### 3. lcov レポーターの追加

- `vitest.config.ts` の `coverage.reporter` に `lcov` を追加し、`coverage/lcov.info` を生成させる (Codecov が解釈する標準フォーマット)

### 4. Codecov 設定ファイル

- リポジトリルートに `codecov.yml` を作成
- カバレッジ状況は **可視化が目的** であり、想定外に PR をブロックしないよう project / patch ステータスは `informational: true` (表示はするが必須チェックにしない)
- PR コメントでカバレッジ差分を表示
- `src/types/**` / `tests/**` / `*.test.ts` を計測対象外にする (vitest 側の exclude と整合)

### 5. README バッジ

- README にカバレッジバッジを追加し、現在のカバレッジが一目で分かるようにする

### 6. ドキュメント更新

- `docs/development-guidelines.md` の「CI/CDパイプライン」節を、`test` ジョブの変更 + Codecov アップロード + 必要 secret に追従させる

## 受け入れ条件

### CI ジョブ

- [ ] `test` ジョブで `npm run test:coverage` が成功し、`coverage/lcov.info` が生成される
- [ ] `codecov/codecov-action@v5` ステップが追加され、PR・main push 双方でカバレッジが Codecov に送られる
- [ ] Codecov のアップロードが失敗しても `test` ジョブ自体は落ちない (`fail_ci_if_error: false`)
- [ ] 既存 unit テストが全て pass する (カバレッジ計測経由でも結果は同じ)
- [ ] `vitest.config.ts` の既存 threshold (services 90% / lib 80%) は維持する

### 可視化

- [ ] PR に Codecov の差分コメントが付く (Codecov 側でリポジトリ連携後)
- [ ] README にカバレッジバッジが表示される

### ローカル開発への影響

- [ ] `npm run test:coverage` のローカル挙動に副作用が無い (reporter に lcov を足すだけ)
- [ ] 既存 threshold によるローカルでのカバレッジゲートは変更しない

## 成功指標

- Codecov のダッシュボードで main / 各 PR のカバレッジが時系列で参照できる
- PR ごとに「この変更でカバレッジがどう動いたか」がコメントとステータスで見える
- CI の `test` ジョブ実行コストが二重実行にならない (split 実行ではなく単一の coverage 実行に統合)

## スコープ外

- カバレッジ threshold の引き上げ・新規ゲート化 (今回は可視化が目的。`informational: true` で非ブロッキング)
- integration テストの新規追加 (テスト本体は今回触らない)
- e2e (Playwright) のカバレッジ計測 (vitest スコープ外、別途検討)
- Codecov 上のリポジトリ作成・`CODECOV_TOKEN` secret 登録 (GitHub/Codecov の管理画面操作。Claude では実行不可のため申し送りで明示)
- Codecov の Components / Flags の詳細チューニング (最小構成で導入し、運用後に調整)

## 参照ドキュメント

- `docs/development-guidelines.md` - CI/CD パイプライン / カバレッジ目標
- `.github/workflows/ci.yml` - 現行 CI 設定 (`test` ジョブ)
- `vitest.config.ts` - 現行 coverage 設定
- `package.json` - `test:coverage` スクリプト
- `renovate.json` - github-actions グループ (codecov-action の自動更新対象)
