# タスクリスト: biome.json の $schema 追従 (Issue #402)

## フェーズ1: 実装

- [x] `biome.json` の `$schema` を `./node_modules/@biomejs/biome/configuration_schema.json` に変更
- [x] `docs/development-guidelines.md` の Biome 節に `$schema` をローカル参照にしている理由を 1 行追記

## フェーズ2: 検証

- [x] `pnpm run check` の出力に info を含む診断が無いことを確認（456 files、Found 行なし）
- [x] 旧バージョン（2.6.2）の URL に戻すと info が再現することを確認（変更前の同じ worktree で `Found 1 info`）
- [x] lint:md / check / typecheck / test を実行（lint:md 0 issues、tsc エラーなし、vitest 494 passed）

## 実装後の振り返り

### 実装完了日

2026-11-02

### 計画と実績の差分

- docs への追記は 1 行の予定が 1 段落（2 文）になった
- Issue 作成時（2026-11-01）は CLI 2.6.3 だったが、着手時点の main は Renovate により 2.6.4 に上がっていた。URL 固定では 1 日で差が広がることを実地で確認できた
- `pnpm run lint` も実行し、456 files・exit 0 を確認した

### 学んだこと

- biome の `deserialize` の info はエラー扱いではなく exit 0 のまま出続ける。#401 の作業中は別原因（未整形ファイル）の失敗と取り違えた。失敗の原因は診断の重要度（× / i）で切り分ける
- ローカルのスキーマ参照は `pnpm install` 前だとエディタ補完が効かないが、check には影響しない

### 次回への改善提案

- 依存のバージョンを設定ファイルに書き写す箇所は、lockfile だけの更新で取り残されないかを確認する
