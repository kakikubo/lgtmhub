# 要求: LCP 候補を画像からテキストに移し、Load delay をゼロにする

## 関連 Issue

- https://github.com/kakikubo/lgtmhub/issues/60
- 関連: 既存 `priority` 化 (.steering/20260506-lcp-priority-image/) を踏まえた次の一手

## 背景

2026-05-08 時点の Chrome DevTools Performance trace で、トップページ
https://lgtmhub.vercel.app/ の **LCP は 807ms**。内訳は TTFB 24ms / **Load delay
595ms** / Render delay 188ms で、LCP 要素は `next/image` で描画される最初の LGTM
画像 (image-card 1 枚目)。

比較対象 https://lgtmoon.com/ は LCP 91ms。LCP 要素がテキストで Load delay が
ゼロのため、画像バイト到着を待たずに LCP が確定している。

現状の `app/(site)/page.tsx:58-66` の見出しは `text-2xl` の単行 `<h1>LGTM 画像一覧</h1>`
で、面積が画像カードに比べて小さく LCP 候補にならない。

## 目的

ファーストビューで最も大きい要素をテキストにし、LCP 要素を `<img>` から `<h1>`
等のテキストに切り替えることで Load delay をゼロにする。

## スコープ

### 含める

- `app/(site)/page.tsx` のヘッダー領域をヒーロー風に再構成 (大きい h1 + 説明文)
- ヒーローテキストが画像カードよりも視覚的に大きい LCP 候補となるよう Tailwind
  クラスで段組・サイズを調整
- 既存 E2E (`tests/e2e/image-list.test.ts`) の見出し名アサーションをヒーロー新文言に追従

### 含めない

- 画像 `priority` 仕様の縮小 (現状 4 枚 preload は維持。テキスト LCP 化後の
  重要度低下は許容するが、UX 上の image load delay 削減効果は残す)
- inline base64 / blur placeholder 採用 (代替案として検討するが、ヒーローテキスト
  化で目標達成可能であれば本 PR では採用しない)
- PPR (Issue #54) や `next/font` の最適化など、別 PR で扱うべき施策

## 完了条件 (改善前後の指標)

| 指標 | 改善前 (2026-05-08 計測) | 目標 |
|---|---|---|
| LCP | 807ms | **300ms 以下** |
| Load delay | 595ms | **0ms（テキスト LCP の場合）** |
| Render delay | 188ms | 150ms 以下 |
| LCP 要素 | `<img>` (image-card 1枚目) | `<h1>` 等のテキスト要素 |
| CLS | 0.00 | 0.05 以下を維持 |

### 計測手順

```
Chrome DevTools > Performance > Record (reload)
→ 取得した trace の LCP 値と要素を確認
```

ネットワーク・CPU スロットルなしで、本番 URL に対して 3 回計測した中央値で比較
する。

## 受け入れ条件

- [ ] トップページ初回表示で `<h1>` (ヒーロー見出し) が LCP 要素として選出される
- [ ] Vercel production 計測 3 回中央値で LCP ≤ 300ms / Load delay ≤ 50ms
- [ ] CLS が 0.05 以下に保たれる (大きい h1 のフォント切替で layout shift を起こさない)
- [ ] 既存 E2E (`tests/e2e/image-list.test.ts`) が pass する (見出しアサーションを
      新文言へ更新)
- [ ] `npm run lint` / `npm run typecheck` / `npm test` が pass する

## ステークホルダー

- 開発: kakikubo
- レビュー: implementation-validator (品質検証)
