# 設計: トップページ LCP 改善 (画像 priority 化)

## アプローチ概要

`next/image` の `priority` prop をファーストビュー画像に付ける。`priority={true}` を指定すると Next.js が自動的に以下を設定する:

- `fetchpriority="high"`
- `loading="eager"`
- `<head>` に `<link rel="preload" as="image">` を挿入 (ただし `fill` 利用時は `sizes` も加味)

## 変更ファイル

### 1. `components/image-card.tsx`

`priority` を Optional prop として受け取り、`<Image>` に転送する。

```tsx
export function ImageCard({
  image,
  priority = false,
}: {
  image: PublicLgtmImage;
  priority?: boolean;
}) {
  // ...
  <Image
    src={image.imageUrl}
    alt="LGTM"
    fill
    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
    className="object-cover"
    priority={priority}
  />
  // ...
}
```

### 2. `components/image-grid.tsx`

`map` の index を使い、先頭 4 枚に `priority` を渡す。

```tsx
const PRIORITY_IMAGE_COUNT = 4;

export function ImageGrid({ images, testId = 'image-grid' }: ImageGridProps) {
  return (
    <ul ...>
      {images.map((image, index) => (
        <li key={image.id}>
          <ImageCard image={image} priority={index < PRIORITY_IMAGE_COUNT} />
        </li>
      ))}
    </ul>
  );
}
```

## なぜ N=4 か

グリッドのカラム数:

- `grid-cols-2` (モバイル): 1 行 = 2 枚 → 4 枚 = 2 行
- `md:grid-cols-3` (タブレット): 1 行 = 3 枚 → 4 枚 = 1 行 + 1 枚
- `xl:grid-cols-4` (PC): 1 行 = 4 枚 → 4 枚 = 1 行

カードのアスペクト比 4:3 で各カラム幅 ≒ 25-50vw。1080p デスクトップでは 1 行目 (4 枚) はほぼ確実にファーストビュー。**4 枚すべてに `priority` を渡しても LCP 候補は実行時に 1 枚に絞られる**ため、`<head>` に preload が 4 つ載るだけで害はない (Next.js は既に同じ挙動を Document に推奨している)。

> 参考: Next.js 公式の "If your page has multiple images above the fold ... you can use priority for all of them" (https://nextjs.org/docs/app/api-reference/components/image#priority)

## アーキテクチャへの影響

- 既存パターン (Server Component + `next/image`) を踏襲
- `PublicLgtmImage` 型・`buildImageService` の挙動・API 仕様は不変
- `LoadMoreButton` 経由の追加カードに priority は不要 (ファーストビュー外で発生する追加読み込みのため)

## テスト戦略

- 既存の E2E (`tests/e2e/image-list.test.ts`) で UI が壊れていないことを確認
- ユニットテストは新設しない: 純粋な prop 透過 (UI スナップショット相当) であり、Next.js の `<Image>` の挙動はフレームワーク側責務
- 効果検証は Chrome DevTools MCP で本番デプロイ後に行う (Vercel preview があれば PR 上でも可能)

## 既知のリスク / 代替案検討

- **N を増やす案 (例: 8)**: ファーストビュー外の画像に preload が走ると無駄な帯域を使う。**N=4 が安全**
- **`priority` ではなく `loading="eager"` だけ付ける案**: `fetchpriority="high"` が付かないため、LCP 改善効果が下がる。`priority` の方が確実
- **`<head>` に手動で `<link rel="preload">` を書く案**: Next.js のメカニズムを使う方が変更箇所が少なくメンテしやすい
