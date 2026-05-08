# 要求内容

## 背景

トップページ画像 (12 枚) はすべて Next.js Image Optimization (`/_next/image?url=...&w=640&q=75`) 経由で配信されており、Vercel Edge → Vercel Blob fetch → リサイズ/再エンコード → 配信 のチェーンを通る。
2026-05-08 の Performance trace では、コールドキャッシュ時に LCP 画像 1 枚で **Load delay 595ms / TTFB 約 540ms** を消費していた (関連 issue: #61)。

直近 commit 27df379 で **元画像が 266×199 の WebP に正規化済み** であり、そもそも `next/image` 側の追加リサイズ・再エンコードはほぼ無意味な状態になっている。
Vercel Blob は既にグローバル CDN で配信されており、`Cache-Control: public, max-age=31536000, immutable` が付与されているため、`unoptimized` で直接配信に切り替えれば Edge Optimizer のオーバーヘッドを丸ごと削れる。

## 関連 Issue

- 本作業: https://github.com/kakikubo/lgtmhub/issues/61
- 前提となる画像正規化: 27df379 (266×199 WebP 中央クロップ)
- 関連: #54 (PPR), #57 (LCP priority), #66 (LCP 要素テキスト化)

## 今回の対応範囲

`components/image-card.tsx` の `<Image>` を、Vercel Blob 直配信 (`_next/image` バイパス) に変更する。

### スコープに入れる

- `components/image-card.tsx` の `<Image>` を `unoptimized` 化、または等価な書き換え
- `fill` + `sizes` で srcset を生成している現状から、固定幅 `width={266} height={199}` への切り替え
- 親 `div` の `aspect-[4/3]` を 266×199 に整合させるか、`<Image>` の固定サイズに依存させる
- 既存テスト (`tests/e2e/image-list.test.ts` の `fetchpriority=high` / `loading=eager` チェック) を壊さないこと
- ドキュメント更新: 詳細ページ (`app/(site)/images/[id]/page.tsx`) はトップページの LCP 経路ではないため、本 PR ではスコープ外。スコープを揃える必要があるかどうかは振り返りで言及する

### スコープに入れない

- `next.config.ts` の `images.loader` カスタム化 (一発で `unoptimized` で済むため、より大きい変更は今回行わない)
- 詳細ページ (`/images/[id]`) の `<Image>` の同一改修 (PR を分けて評価したい / 1 PR = 1 関心事)
- 元画像のさらなる軽量化 (AVIF 化など)
- Vercel Blob 側の Cache-Control 変更 (現状 `immutable` なので不要)

## 完了条件 (issue #61 に準拠)

| 指標 | 改善前 (2026-05-08) | 目標 |
|---|---|---|
| LCP 画像の Load delay | 595ms | **150ms 以下** |
| LCP 画像 URL の TTFB | 約 540ms | **100ms 以下** (Blob 直 / CDN ヒット時) |
| `_next/image` リクエスト数 | 12 / 初回ロード | **0** |
| LCP | 807ms | 400ms 以下 |
| 画像転送サイズ合計 | 計測必要 | 増加しないこと (最大 +5%) |

加えて、以下のコード品質要件を満たす:

- `npm test` / `npm run lint` / `npm run typecheck` がすべてパスする
- `tests/e2e/image-list.test.ts` の既存検証 (`fetchpriority=high`, `loading=eager`) が通り続ける
- `components/image-card.tsx` 単体の変更で他コンポーネントを巻き込まない (1 PR = 1 関心事)

## 受け入れ確認手順

issue #61 の「計測手順」を踏襲する。本 PR では `_next/image` バイパスが DOM 上で確認できる時点を完了とする。

1. `npm run dev` でローカル起動し、トップページのネットワークを確認
   - 画像リクエストの URL が `https://*.public.blob.vercel-storage.com/lgtm/<uuid>.webp` 直になっていること (`_next/image?url=...` ではない)
   - `_next/image` リクエスト数が 0
2. 先頭カードの `<img>` に `fetchpriority="high"` `loading="eager"` が付いていること (既存 e2e で担保)
3. 画像表示が崩れない (サムネイルが 266×199 ベースのカード枠内に収まる) ことを目視
4. Vercel Preview デプロイで Performance trace を取り、LCP 画像の Load delay / TTFB が目標範囲に入ることを確認 (PR 後の作業として issue にリプライ)
