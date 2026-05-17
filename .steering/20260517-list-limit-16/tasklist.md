# タスクリスト: 一覧画面の1ページ表示件数を16枚に制限する

## 実装

- [x] `src/lib/validation/image.ts` の `LIST_IMAGES_DEFAULT_LIMIT` を 20 → 16 に変更
- [x] `tests/unit/lib/validation/image.test.ts` の期待値を `toBe(16)` に更新
- [x] `tests/unit/services/image-service.test.ts` のタイトル/アサーション/コメントを 16 に更新

## ドキュメント整合

- [x] `docs/functional-design.md` のデフォルト件数記述を 16 に更新
- [x] `docs/product-requirements.md` のページネーション件数記述を 16 に更新
- [x] `docs/product-requirements.md` / `docs/architecture.md` のパフォーマンス指標(初期表示件数)を 16 に更新

## 検証

- [x] `npm test` がパスする (170 passed / 16 files)
- [x] `npm run lint` がパスする (biome: 82 files, no errors ※RTK プロキシ経由で実行)
- [x] `npm run typecheck` がパスする (tsc --noEmit: exit 0)

## 申し送り

### 実装完了日
2026-05-17

### 計画と実績の差分
- 計画では `docs/functional-design.md` の更新対象を `:627` の1箇所のみと想定していたが、
  implementation-validator の指摘により `:223`（`GET /api/images` クエリパラメータ表）も
  旧値 20 のまま残っていたため追加修正。スコープ内の API ドキュメントの更新漏れを是正した。
- `docs/functional-design.md:382`（`GET /api/favorites`）も 20 と記載があるが、これは未実装の
  別機能（お気に入り一覧）の独立した仕様であり、`LIST_IMAGES_DEFAULT_LIMIT` を参照しない。
  Issue #108 のスコープ外と判断し意図的に変更せず据え置いた。

### 学んだこと
- single source of truth の参照構造（定数 → `listImages()` デフォルト → 初期表示/API 双方）が
  既に確立されていたため、本体コード変更は定数1行のみで完結した。
  事前の現状調査で参照グラフを把握したことが影響最小化に直結した。
- E2E (`tests/e2e/image-list.test.ts`) は件数を DOM から動的取得しており件数非依存。
  受け入れ条件「必要なら更新」に該当せず変更不要と確定できた。
- 仕様ドキュメントは同一フォーマットの行が複数 API で重複するため、grep で全件洗い出し、
  スコープ内/外を API 単位で切り分ける必要がある（favorites との混同を回避）。

### 次回への改善提案
- ドキュメント整合タスクは「定数名で全文 grep → API 単位でスコープ判定」を計画段階で
  チェックリスト化すると、今回のような更新漏れを planning 時点で防げる。
- 件数定数のように複数ドキュメントに数値が散在する設定値は、ドキュメント側を
  「`LIST_IMAGES_DEFAULT_LIMIT` を参照」と定数名表記に寄せると将来の追従漏れを減らせる
  （本対応で `:223` `:627` は定数名併記に変更済み）。

### 受け入れ条件の充足
- [x] 初回表示が16件（`getHomeImagesInitial` → `listImages()` がデフォルト 16）
- [x] 17件以上で「もっと読み込む」が次の16件取得（`nextCursor` ロジック limit 非依存・単体テスト担保）
- [x] 16件以下で「もっと読み込む」非表示（`records.length === limit` 不成立で nextCursor=null）
- [x] 16 を共通定数で一箇所定義、初期表示と API デフォルト双方が参照
- [x] 既存 E2E は件数非ハードコードのため不変更でパス継続
