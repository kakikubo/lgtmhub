# 要求内容

## 概要

`app/api/images/route.ts` の POST ハンドラにテストを追加し、未検証のまま本番稼働している画像登録 API の挙動を担保する。Issue #258。

## 背景

- Issue #255 / PR #256 で `app/api/**` をカバレッジ計測対象に加えた結果、`app/api/images/route.ts` が **34.88%**（Branch 32.14% / Funcs 33.33% / Lines 35.71%）と判明した
- リポジトリ全体の Lines が 95.00% → 89.63% に下がった主因はこの 1 ファイルに集中していた
- 調査の結果、**未カバーの 57〜98 行は POST ハンドラ全体**だった
- `tests/unit/api/images/` には `list-route` / `delete-route` / `random-route` / `regenerate-route` の 4 本があるが、**画像登録（POST /api/images）のテストが 1 本も無い**
- GET は 5 ケースでカバーされている一方、POST は認証チェック・zod バリデーション・6 分岐のエラー変換がすべて未検証だった
- これは計測の問題ではなく**実際のテスト不足**であり、カバレッジ数値の改善はその副産物

## 実装対象の機能

### 1. POST /api/images の単体テスト追加

新規ファイル `tests/unit/api/images/create-route.test.ts` を追加する。プロダクションコードは変更しない。

網羅する分岐:

- 未認証 → 401（Service を呼ばない）
- body が壊れた JSON → 400（`request.json().catch(() => null)` 経路）
- `imageUrl` が HTTPS でない → 400
- 正常系 → 201 + `createImageResponseSchema` 準拠 + `createImage(userId, url)` の引数
- 正常系 → `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')`
- `DuplicateImageError` → 409 + `existingImageId`
- `DailyLimitExceededError` → 429
- `BadRequestError` → 400
- `UnauthorizedError` → 401
- その他 `AppError` → 500（内部メッセージを漏らさない）
- 想定外のエラー → 500（同上）

## 受け入れ条件

- `app/api/images/route.ts` の Lines カバレッジが 90% 以上
- 全テストが pass し、既存 thresholds を通過する（`test:coverage` exit 0）
- `biome check` / `tsc --noEmit` が exit 0
- CI グリーン、Codecov でカバレッジの上昇を確認

## 成功指標

- `app/api/images/route.ts`: 34.88% → 90% 以上
- リポジトリ全体の Lines: 89.63% → 上昇

## スコープ外

- `app/api/images/route.ts` 本体の変更（テスト追加のみ）
- 既存 3 テストファイルの `next/cache` モック統一
- Issue #259（`app/api/**` の閾値設定）— 本 PR で CI 実測値が変わるため、その後に判断する

## 参照ドキュメント

- Issue #258 / #255 / #256
- `app/api/CLAUDE.md`（エラー変換の順序、revalidateTag の必要性）
- `tests/unit/api/images/list-route.test.ts`（同一ファイルの GET テスト）
