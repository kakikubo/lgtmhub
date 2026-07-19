# 設計書

## アーキテクチャ概要

テスト追加のみ。プロダクションコードの構造には影響しない。既存の route handler テストと同じ「モジュールモック + 動的 import」方式を踏襲する。

## コンポーネント設計

### 1. `tests/unit/api/images/create-route.test.ts`（新規）

既存の `list-route.test.ts` と同じモック構成:

| モック対象 | 理由 |
|---|---|
| `next/cache` | `revalidateTag` の呼び出しを検証。`unstable_cache` は route が `@/src/lib/cache/list-home-images` 経由で初期化するためパススルー実装が必要 |
| `@/src/lib/supabase/server` | `createClient()` を差し替え、`auth.getUser()` の戻り値で認証状態を制御 |
| `@/src/services/image-service` | `buildImageService()` を差し替え、`createImage` の解決/棄却でエラー分岐を駆動 |

ヘルパー:

- `mockAuthenticatedAs(user | null)` — `getUser()` の戻り値を組み立てる。認証状態の切り替えが全ケースで必要なため関数化
- `callPost(body?, { rawBody? })` — `new Request(...)` を組み立てて `POST` を呼ぶ。`rawBody` は壊れた JSON を送るケース専用

レスポンス検証は `createImageResponseSchema` / `createImageErrorResponseSchema` で行う（`list-route.test.ts` が `listImagesResponseSchema` を使うのと同じ方針。`app/api/CLAUDE.md` の「レスポンス側のスキーマも定義する」に対応）。

### 既存パターンからの意図的な逸脱

既存 3 ファイルの `next/cache` モックは `revalidateTag: (tag: string) => revalidateTag(tag)` で**第 2 引数を捨てている**。本 route は `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')` とプロファイルを渡すため、それを検証するには可変長で受ける必要がある。

```typescript
revalidateTag: (...args: unknown[]) => revalidateTag(...args),
```

この新規ファイル内だけこの形にし、理由をコメントで残す。既存 3 ファイルには手を入れない（今回の関心事ではない）。

タグ名は文字列リテラルではなく `HOME_IMAGES_CACHE_TAG` を import して比較する。実装と定数を共有することで、タグ名の変更時にテストが自動追随する。

## テスト戦略

route handler の責務（認証チェック・バリデーション・service 呼び出し・エラー変換）に対応する 11 ケース。ビジネスロジックは service 側のテストが担うため、ここでは**変換の正しさ**のみを見る。

エラー変換は `app/api/CLAUDE.md` の規約どおり具体サブクラス → `AppError` の順に分岐するため、テストもその順序どおりに並べ、各分岐が上位の分岐に吸われないことを確認する。

## 依存ライブラリ

追加なし。

## 実装の順序

1. `create-route.test.ts` を作成
2. `vitest run --coverage` で全体を実行し、対象ファイルのカバレッジと既存 thresholds を確認
3. `biome check` / `tsc --noEmit`
4. コミット・PR 作成
5. CI と Codecov で実測値を確認

## セキュリティ考慮事項

500 系のケースで内部メッセージ（`AppError` の message や素の `Error` の message）がレスポンスに漏れないことを明示的に assert する。route の実装意図をテストで固定する。

## パフォーマンス考慮事項

テスト 11 件の追加のみ。実行時間への影響は無視できる。

## 将来の拡張性

`app/api/**` に per-glob 閾値を設ける場合（Issue #259）、本 PR 後の CI 実測値が基準になる。
