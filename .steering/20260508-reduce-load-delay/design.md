# 設計

## 方針

`components/image-card.tsx` の `<Image>` に `unoptimized` を付与し、`fill` + `sizes` を **固定 width/height** へ切り替える。

理由:

- 元画像が 266×199 WebP に正規化済みなので、Next.js Image Optimization (リサイズ/再エンコード) は実質不要
- Vercel Blob は既にグローバル CDN 配信であり、`Cache-Control: public, max-age=31536000, immutable` が付与されている (architecture.md「キャッシュ戦略」)
- `_next/image` を経由するだけで Edge Function でのリサイズ・再エンコードのオーバーヘッドが入り、初回 (CDN ミス時) はそのまま LCP 悪化に直結する
- カスタムローダー (`next.config.ts` の `images.loader`) も同等の効果を出せるが、設定面が増える割に得るものが同じなので、より小さな変更である `unoptimized` を選ぶ

## Before / After

### Before (`components/image-card.tsx`)

```tsx
<div className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-50">
  <Image
    src={image.imageUrl}
    alt="LGTM"
    fill
    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
    className="object-cover"
    priority={priority}
  />
</div>
```

- `fill` + `sizes` により、`_next/image` が `w=640&q=75` の variant を生成・配信
- `aspect-[4/3]` は 266×199 (≒ 4:3) と整合的だが、`object-cover` で誤差を吸収していた

### After

```tsx
<div className="overflow-hidden rounded border bg-gray-50">
  <Image
    src={image.imageUrl}
    alt="LGTM"
    width={266}
    height={199}
    sizes="266px"
    className="h-auto w-full object-cover"
    priority={priority}
    unoptimized
  />
</div>
```

ポイント:

- **`unoptimized`**: `_next/image` をバイパスし、`src` をそのまま `<img src>` に流す。Vercel Blob URL に対して直 fetch される
- **`width={266} height={199}`**: 元画像と同じサイズを明示。ブラウザのレイアウトシフト (CLS) を防ぐために必須 (`fill` を外すと暗黙の 0×0 になる)
- **`sizes="266px"`**: 詳細ページと同じ流儀。`unoptimized` でも `srcset` 自体は付かないが、警告抑制と将来 `unoptimized` を外したくなった時のために残す
- **`h-auto w-full`**: グリッドのカード幅に追従させ、画像のアスペクト比 (266×199) を維持する
- **`object-cover`**: 親 `div` のサイズに対する fallback。固定 width/height にしたので原理的には不要だが、グリッド幅 < 266px のレスポンシブ局面で潰さないための保険として残す
- **`aspect-[4/3]` の削除**: 266×199 = 1.337... ≒ 4:3 ではあるが厳密には `aspect-[266/199]`。`<Image>` 自体が幅高比を保つので親側のアスペクト指定は不要 (削った方が DOM/CSS が軽い)

### 親 `div` の `relative` を削る理由

`fill` レイアウトでは親が `position: relative` 必須だが、固定 width/height レイアウトでは不要。残しても害はないが、今回の責務がなくなるので削除する。

## next.config.ts への影響

`images.remotePatterns` は **触らない**。

`unoptimized` で `_next/image` を通らなくなっても、`<Image>` コンポーネント自体は `remotePatterns` を参照する (build 時の検証用)。Vercel Blob ホストは既に登録済みなので変更不要。

## 既存テストへの影響

### `tests/e2e/image-list.test.ts`

- 「先頭カードの img に fetchpriority=high と loading=eager が付く」テストが存在する
- `next/image` は `priority` を渡すと `fetchpriority="high"` `loading="eager"` を出力する。これは `unoptimized` 有無に関わらず維持される
- `<Image>` のラッパー DOM が `fill` から固定 width/height で多少変わるが、`grid.locator('img').first()` で取れる対象は同じ
- ⇒ **既存テストはそのまま通る** はず。ただし念のためローカルで E2E を流して確認する

### `tests/e2e/image-detail.test.ts` / `image-deletion.test.ts`

- `getByTestId('image-card-link')` を使っており、`<Link data-testid="image-card-link">` 自体は変更しない
- ⇒ **影響なし**

### unit / integration テスト

- `components/image-card.tsx` を直接テストしているファイルは存在しない (grep で確認済)
- ⇒ **影響なし**

## 品質指標 (issue #61 完了条件) との対応

| 指標 | 改善メカニズム |
|---|---|
| LCP 画像の Load delay 595ms → 150ms 以下 | `_next/image` の Edge 処理を丸ごと省略。CDN 直配信になり Edge Function 起動オーバーヘッドが消える |
| LCP 画像 URL の TTFB 540ms → 100ms 以下 | Vercel Blob CDN は世界配信されており、最寄りエッジから直配信になる |
| `_next/image` リクエスト数 12 → 0 | `unoptimized` により全 12 枚が `_next/image` を経由しなくなる |
| LCP 807ms → 400ms 以下 | Load delay 短縮の累積効果。LCP 要素は #66 でテキストに切り替えているが、Largest Image Painted も合わせて改善する |
| 画像転送サイズ +5% 以内 | 元画像が既に 266×199 WebP に正規化済 (`q=75` の再エンコードで微小に縮んでいた可能性はあるが、元 WebP は十分に小さいはず) |

## リスクと緩和

| リスク | 影響 | 緩和策 |
|---|---|---|
| 元画像が 266×199 でないレガシー画像が DB に残っている | カード表示が歪む | 詳細ページ側は `image.width` / `image.height` を DB から渡しているため対応済。一覧側 (image-card) は固定 266×199 で表示するため、レガシー画像も `object-cover` で吸収。Issue #61 の前提条件 (commit 27df379 で正規化済) を信じる |
| `unoptimized` で AVIF 変換が効かなくなり転送サイズが増える | 帯域増 | 元が WebP の時点で AVIF 変換しても削減幅は限定的 (10〜20%)。Edge 処理オーバーヘッド (Load delay 595ms) を消す方が効果が大きい |
| `priority` の `fetchpriority="high"` が効かなくなる | LCP 悪化 | next/image は `unoptimized` でも `priority` 属性をそのまま `<img>` に流す。E2E テストで担保 |
| Vercel Blob が落ちた場合のフォールバックが効かない | 画像表示できない | これは `_next/image` 経由でも同じ (Vercel Blob を fetch するため)。`unoptimized` で挙動は変わらない |

## 採用しない代替案

### 案 A: `next.config.ts` の `images.loader` をカスタム化

```ts
images: {
  loader: 'custom',
  loaderFile: './src/lib/image/blob-loader.ts',
}
```

- メリット: `Image` コンポーネント側を触らずに済む / 将来 `_next/image` を再有効化したい時の戻し方が綺麗
- デメリット: `loader: 'custom'` はサイト全体に適用される。詳細ページや今後増えるかもしれない avatar 画像などにも影響が及ぶ
- 結論: 影響範囲が広い。今回はトップページ画像のみが対象なので、`unoptimized` をカード単位に付ける方が責務が局所化する

### 案 B: `loader` プロパティを `<Image>` 単位で渡す

```tsx
<Image loader={blobLoader} src={...} />
```

- メリット: コンポーネント単位で適用範囲を絞れる
- デメリット: `unoptimized` と等価な振る舞いになるが、ローダー関数を新設する分だけコード量が増える
- 結論: `unoptimized` で同じ効果が得られるので不採用

## 影響を受けるドキュメント

- `docs/architecture.md` の「キャッシュ戦略」「パフォーマンス要件」: 直接の文言変更は不要 (記述レベルが粒度的に粗い)
- `docs/functional-design.md`: 画像表示部分の説明があれば更新候補だが、最適化の有無は実装詳細なので原則更新しない
- 振り返り時に再評価する
