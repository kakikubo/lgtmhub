# tasklist.md — アニメーション GIF を登録対象に追加する

## 実装タスク

- [x] T1. `src/lib/image/validate-image.ts` のアニメ GIF 拒否ブロック削除 + MAX_GIF_FRAMES (150) ガード追加 + `pages` を ValidatedImage に追加
- [x] T2. `tests/unit/lib/image/validate-image.test.ts` を更新 (旧拒否テスト削除、フレーム上限テスト追加、`pages` 戻り値検証追加)
- [x] T3. `src/lib/image/compose-lgtm.ts` をアニメーション対応に書き換え (`{ animated: true }` 読み込み + 縦タイル composite + animated WebP 出力 + `isAnimated` 戻り値追加 + フレーム上限二重防御)
- [x] T4. `tests/unit/lib/image/compose-lgtm.test.ts` を更新 (静止画戻り値の `isAnimated:false` 検証、3 フレーム GIF → animated webp ケース追加、フレーム上限テスト追加)
- [x] T5. DB マイグレーション `supabase/migrations/20260626000000_add_lgtm_images_is_animated.sql` を作成 (`is_animated boolean NOT NULL DEFAULT false`)
- [x] T6. `src/types/database.types.ts` の `lgtm_images.Row` / `Insert` に `is_animated` を追記
- [x] T7. `src/types/image.ts` の `LgtmImage` / `PublicLgtmImage` に `isAnimated` を追加
- [x] T8. `src/lib/validation/image.ts` の `imageListItemSchema` に `isAnimated: z.boolean()` を追加 + 関連 zod schema を整合
- [x] T9. `src/repositories/image-repository.ts` の `toLgtmImage` / `toInsert` / `CreateLgtmImageInput` を更新
- [x] T10. `src/services/image-service.ts` で `composeLgtmImage` の戻り値から `isAnimated` を取り出して `imageRepo.create({ ..., isAnimated })` へ伝搬 + `toPublic()` 更新
- [x] T11. `tests/unit/services/image-service.test.ts` を更新 (`composeLgtmImage` モックに `isAnimated` 追加、アニメ入力ケース 1 件追加、buildImage の defaults 更新)
- [x] T12. `app/(site)/images/[id]/page.tsx` の `<Image>` に `unoptimized` を追加
- [x] T13. `app/api/images/route.ts` に `export const maxDuration = 60` を追加
- [x] T14. その他参照箇所 (e2e の fixture / SQL ダンプ等) で `isAnimated` 必須化に伴う破壊が無いか確認・修正

## 振り返り

### 実装完了日
2026-06-26

### 計画と実績の差分
- **計画外で発生した修正**:
  - `components/home-images.tsx` / `components/load-more-button.tsx`: クライアントが JSON から `PublicLgtmImage` を再構築するロジックで `isAnimated` を復元する必要があった (型必須化に伴い TS エラー)。
  - `tests/unit/repositories/image-repository.test.ts` / `tests/unit/lib/validation/image.test.ts` / `tests/unit/api/images/{list,random}-route.test.ts` の fixture すべてに `isAnimated` / `is_animated` を追加 (型必須化の波及)。
  - `app/(site)/images/[id]/page.tsx` の `unoptimized` を **`unoptimized={image.isAnimated}` の条件化** に修正 (静止画は Next.js Image Optimizer を活かす)。
- **設計どおりに通った点**:
  - sharp の `{ animated: true }` + per-frame composite + animated WebP の合成パイプライン。
  - フレーム数 150 上限の二重防御 (validate-image / compose-lgtm 両方で BadRequestError)。
  - DB マイグレーション `is_animated boolean NOT NULL DEFAULT false` で既存行を非破壊に更新。

### 学んだこと
- **sharp の animated 入力でのリサイズは per-frame 単位**: `.resize(targetWidth, targetPageHeight, ...)` を渡せば sharp が全 pages に同じ変換を適用する。`targetPageHeight * pages` を渡すと各フレームを縦方向に過剰拡大してしまう。
- **sharp の `metadata()` は `{ animated: true }` 指定で挙動が変わる**: 指定なしは「先頭フレーム視点」(pageHeight が undefined、height はフレーム高さ)、指定ありは「縦タイル全体視点」(height = pageHeight × pages、pageHeight が定義される)。テストで output の pageHeight を見たいときは必ず `{ animated: true }` を指定する必要がある。
- **sharp の GIF エンコーダはフレームを deduplicate する**: `delay` が単一値 (`[100]`) でフレーム同士が同一だと出力 pages が n より少なくなる (今回は 151 → 19 に圧縮された)。テストで n フレームを保証するには「delay 配列長 = n」かつ「フレームごとに RGB を変化させる」必要がある。
- **`PublicLgtmImage` を必須プロパティ拡張すると client→server 復元コードが TS エラーになる**: home-images / load-more-button の手動 JSON マッピングが影響を受けた。今後同様の変更時は client 側の zod 復元コードを必ずチェックする。

### 次回への改善提案
- **MAX_GIF_FRAMES の調整**: 実プラン (Vercel Pro/Hobby) を確認したら本値を見直す。Hobby なら 30 〜 50 程度に下げて `maxDuration = 10` に戻す必要がある。
- **`PublicLgtmImage` 拡張時のチェックリスト整備**: 「型を追加 → クライアント JSON 復元コードもチェック」を development-guidelines に明記してもよい。
- **アニメ入力の e2e テスト**: 現状は unit テストのみカバー。Playwright + fixtures/anim-test.gif を追加して 3 経路 (登録 / 一覧表示 / 詳細表示 / マークダウンコピー先) の動的挙動を確認する PR を別途立てるとよい。
- **UI バッジ (動く画像 / GIF) の表示**: `is_animated` をすでに API で返しているので、追加 PR で `<ImageCard>` / 詳細ページに小さなバッジを置くだけで完結する (Issue 本文のスコープ外なので別 Issue を切る)。
