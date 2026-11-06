# タスクリスト: src/repositories と app/api/favorites にカバレッジ閾値を設定する (Issue #385)

## フェーズ1: 実装

- [x] 現状のカバレッジを glob ごとに計測し、Codecov の CI 値と突き合わせる
- [x] `apps/web/vitest.config.ts` の `thresholds` に `src/repositories/**` と `app/api/favorites/**` を追加し、根拠をコメントに書く
- [x] `docs/development-guidelines.md` の閾値説明（カバレッジ目標・Codecov 節）を更新
- [x] `docs/architecture.md` のカバレッジ目標を更新

## フェーズ2: 検証

- [x] `pnpm run test:coverage` が新しい閾値で成功することを確認（512 passed, exit 0）
- [x] 閾値が実際に効くことを確認（favorites の branches を 99 にすると `Coverage for branches (85.41%) does not meet "app/api/favorites/**" threshold (99%)` で exit 1。元に戻した）
- [x] check / typecheck / lint:md を実行（biome 476 files 問題なし、tsc エラーなし、markdownlint 0 issues）

## 実装後の振り返り

### 実装完了日

2026-11-03

### 計画と実績の差分

- 差分なし。Issue 起票時に「4 ファイル」だった `src/repositories/**` は 6 ファイルに増えていたが、glob 指定なので影響はない
- implementation-validator の判定は必須修正なし。favorites の statements/lines は余裕が約 2.7pt（2 行分）で、images の約 5pt より薄いと指摘された。総数が 83 statements と小さいので、この幅でも未カバーが 3 行増えれば落ちる。意図した厳しさなので据え置いた

### 学んだこと

- Codecov の public API（`/api/v2/github/{owner}/repos/{repo}/totals/?branch=main&path=...`）を使うと、トークンなしで main の CI 実測を path 単位で取得できる。ただし lines だけで、branches/functions の内訳はローカルの `coverage-summary.json` で補う必要がある
- 閾値の追加は「一時的に閾値を上げて失敗させる」ことで、glob が実際にマッチしていることまで確認できる

### 次回への改善提案

- `components/**` も CI 実測が貯まった段階で、同じ手順（ローカル集計 + Codecov 突き合わせ + 閾値を上げて失敗確認）で閾値化を検討する
