# 要求: トップページ LCP 改善 (画像 priority 化)

## 背景 / 計測結果

Chrome DevTools MCP でトップページ (`https://lgtmhub.vercel.app/`) を計測した結果、LCP の 93% が「Resource load delay」で消費されている。

| 指標 | 値 |
|------|----|
| LCP | 1,193 ms |
| TTFB | 23 ms |
| **Resource load delay** | **1,112 ms (93%)** |
| Resource load duration | ~0 ms |
| Render delay | 58 ms |

LCPDiscovery insight の判定:

- ❌ `fetchpriority=high` 未指定
- ❌ `loading=lazy` で読み込み
- ✅ 初期 HTML から発見可能

原因は `components/image-card.tsx` の `<Image>` に `priority` を指定していないため、ファーストビュー画像も Next.js のデフォルトで `loading="lazy"` (実効 Low priority) になっていること。Vercel の image optimization は機能しており画像本体のダウンロードはわずか 41μs。**「画像が重い」のではなく「取りに行くのが遅い」**のが本問題。

## 対応する PRD / docs

- [PRD 受け入れ条件: パフォーマンス](../../docs/product-requirements.md) — LCP 3 秒以内
- [機能設計書: 画像一覧画面](../../docs/functional-design.md)

## 今回の実装スコープ

トップページのファーストビュー画像 (先頭 N 枚) に対して `priority` 属性を渡し、Resource load delay を解消する。

- `components/image-card.tsx` に `priority?: boolean` を追加し `<Image>` に渡す
- `components/image-grid.tsx` で先頭 N 枚に `priority={true}` を渡す
- N の決定: グリッドが `xl:grid-cols-4` なので、xl 以上では 1 行目 = 4 枚。**N = 4** とする

## 受け入れ条件

### 機能要件

- [ ] `ImageCard` が `priority?: boolean` を受け取り、`<Image priority={priority}>` に渡す。デフォルトは `false`
- [ ] `ImageGrid` が `images.map((image, index) => <ImageCard image={image} priority={index < PRIORITY_IMAGE_COUNT} />)` を行う
- [ ] `PRIORITY_IMAGE_COUNT = 4` を定数として `image-grid.tsx` 内に定義
- [ ] 「もっと読み込む」で追加されるカード (LoadMoreButton 経由) には `priority` を渡さない

### 品質 / 検証

- [ ] `npm run lint` / `npm run typecheck` / `npm test` がエラーなく通る
- [ ] 既存 E2E (`tests/e2e/image-list.test.ts`) が引き続き通る
- [ ] Chrome DevTools MCP で再計測し、LCP の Resource load delay が大幅に短縮されること (目安: 1,112ms → 100ms 未満)
- [ ] LCPDiscovery insight の `fetchpriority=high should be applied` と `should not use loading=lazy` が PASSED になること

## 今回スコープ外 (意図的に除外)

- LoadMoreButton で追加された画像への priority 付与 (ファーストビュー外なので不要)
- `<Link prefetch={false}>` 化 (LCP には影響しない別件)
- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) の最適化 (本 PR では触らない)

## 前提・制約

- グリッドのレスポンシブ仕様: 2 (sm) / 3 (md) / 4 (xl) カラム — 既存の `image-grid.tsx` の挙動を維持
- Next.js `<Image>` の `priority` prop は `fetchpriority="high"` と `loading="eager"` を自動付与する
- ファーストビューに表示されない画像 (5 枚目以降) は引き続き `loading="lazy"` のまま (帯域節約のため)
