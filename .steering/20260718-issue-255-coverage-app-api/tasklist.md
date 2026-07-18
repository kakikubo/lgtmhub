# タスクリスト

Issue #255 — `app/api` をカバレッジ計測対象に追加する

## フェーズ1: 計測範囲の変更

- [x] `vitest.config.ts` の `coverage.include` に `'app/api/**/*.ts'` を追加
- [x] `exclude` / `thresholds` を変更していないことを差分で確認（`git diff` で include 行 + コメントのみの変更を確認）

## フェーズ2: ローカル検証

- [x] `pnpm run test:coverage` を実行し、全テスト pass と既存 thresholds 通過を確認（21 files / 262 tests pass、exit=0）
- [x] `coverage/lcov.info` に `app/api` 配下の 6 route が `SF:` 行として出力されることを確認（`grep -c '^SF:app/api'` = 6）
- [x] `src/services/**` / `src/lib/**` のカバレッジ値が変更前と一致することを確認（services 96.58/98.27/87.09/100、lib 94.73/100/88.88/94.73 で変更前と同値）

## フェーズ3: 品質チェックと修正

- [x] `pnpm run check` (biome) が exit 0（変更ファイルを明示パスで検証。`pnpm` 自体はローカルの corepack shim 不整合で起動できないため `node_modules/.bin/biome` を直接実行）
- [x] `pnpm run typecheck` が exit 0（`node_modules/.bin/tsc --noEmit`）

## フェーズ4: ドキュメント更新

- [x] `docs/development-guidelines.md` L690 付近「カバレッジ目標」の `coverage` スニペットに `include` の実体を反映（`app/api/**` がゲート対象外である旨の補足も追加）
- [x] `docs/development-guidelines.md` L900 付近「集計対象」に計測範囲と `app/(site)` を含めない理由を追記

## フェーズ5: PR とフォローアップ

- [ ] コミット・push・PR 作成（Issue #255 を close する記述を含める）
- [ ] CI の `test` ジョブがグリーンであることを確認
- [ ] Codecov の PR コメントに `app/api` の route が現れることを確認（角括弧パスの取り込み検証を兼ねる）
- [ ] フォローアップ Issue を 3 件起票
  - [ ] e2e カバレッジ収集と `app/(site)/**` の計測
  - [ ] `app/api/images/route.ts` のテスト補強（現状 34.88%）
  - [ ] CI 実測後の `app/api/**` per-glob 閾値の検討

## 実装後の振り返り

### 実装完了日

（未記入）

### 計画と実績の差分

（未記入）

### 学んだこと

（未記入）

### 次回への改善提案

（未記入）
