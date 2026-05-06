# 設計

## 全体方針

`composeLgtmImage()` の出力サイズを「元画像幅に追従する可変サイズ (上限 1200)」から「固定 266×199 中央クロップ」に切り替える。ロジック自体は単純化される (アスペクト比計算が不要になる)。詳細ページの表示も実寸表示に合わせて `max-w-[266px]` を適用する。

## ファイル別変更内容

### 1. `src/lib/image/compose-lgtm.ts`

**変更前**:
```typescript
export const MAX_OUTPUT_WIDTH = 1200;
export const WEBP_QUALITY = 85;

// composeLgtmImage()
const targetWidth = Math.min(originalWidth, MAX_OUTPUT_WIDTH);
const targetHeight = Math.round((originalHeight * targetWidth) / originalWidth);

const overlay = await buildLgtmOverlay(targetWidth, targetHeight, 'LGTM');

const composed = await sharp(buffer)
  .resize(targetWidth, targetHeight, { fit: 'fill' })
  .composite([{ input: overlay, blend: 'over' }])
  .webp({ quality: WEBP_QUALITY })
  .toBuffer({ resolveWithObject: true });
```

**変更後**:
```typescript
export const TARGET_WIDTH = 266;
export const TARGET_HEIGHT = 199;
export const WEBP_QUALITY = 85;

// composeLgtmImage()
const overlay = await buildLgtmOverlay(TARGET_WIDTH, TARGET_HEIGHT, 'LGTM');

const composed = await sharp(buffer)
  .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: 'cover', position: 'center' })
  .composite([{ input: overlay, blend: 'over' }])
  .webp({ quality: WEBP_QUALITY })
  .toBuffer({ resolveWithObject: true });
```

**ポイント**:
- `originalWidth` / `originalHeight` の計算は引き続き必要 (バリデーション目的: 0 以下なら BadRequestError)
- `fit: 'cover'` は元が小さい場合も拡大するデフォルト挙動。`withoutEnlargement` は付けない
- `MAX_OUTPUT_WIDTH` のエクスポートを廃止し、`TARGET_WIDTH` / `TARGET_HEIGHT` に置き換える (依存先は `tests/unit/services/image-service.test.ts` のモックのみ)

### 2. `app/(site)/images/[id]/page.tsx`

**変更前**:
```tsx
<div data-testid="image-detail-image" className="overflow-hidden rounded border bg-gray-50">
  <Image
    src={image.imageUrl}
    alt="LGTM"
    width={image.width}
    height={image.height}
    sizes="(min-width: 768px) 768px, 100vw"
    priority
    className="h-auto w-full"
  />
</div>
```

**変更後**:
```tsx
<div
  data-testid="image-detail-image"
  className="mx-auto max-w-[266px] overflow-hidden rounded border bg-gray-50"
>
  <Image
    src={image.imageUrl}
    alt="LGTM"
    width={image.width}
    height={image.height}
    sizes="266px"
    priority
    className="h-auto w-full"
  />
</div>
```

**ポイント**:
- 既存画像 (1200px 系) も DB 上の `width` / `height` で次第どおりにレンダリングされる。`max-w-[266px]` でコンテナを縛るので、既存大画像も視覚的には 266px 幅で表示される
- `sizes="266px"` で next/image が unnecessary な大きい variant をリクエストしないようにする

### 3. テスト

#### `tests/unit/lib/image/compose-lgtm.test.ts`

5 ケースを書き換え:
1. 出力は WebP かつ 266×199 (任意の入力アスペクト比)
2. 入力アスペクト比違いでも 266×199 になる (横長 / 縦長 / 正方形パラメータライズ)
3. 元が 266×199 より小さい (100×75) 場合でも拡大されて 266×199 になる
4. 中央クロップが効いている: 中央領域だけが残ることを軽く検証 (左半分赤・右半分青の画像で出力中央付近のピクセルが赤と青の境界付近に来ること、もしくは中央領域の色が「中央色」を保持していることを確認)
5. 破損入力は BadRequestError
6. (既存) フォントファイル同梱

`MAX_OUTPUT_WIDTH` のインポートをやめ、`TARGET_WIDTH` / `TARGET_HEIGHT` をインポートする。

#### `tests/unit/services/image-service.test.ts`

`vi.mock('@/src/lib/image/compose-lgtm', ...)` 内のモックを以下に変更:
```typescript
vi.mock('@/src/lib/image/compose-lgtm', () => ({
  composeLgtmImage: (...args: unknown[]) => composeLgtmImage(...args),
  TARGET_WIDTH: 266,
  TARGET_HEIGHT: 199,
  WEBP_QUALITY: 85,
}));
```

#### `tests/e2e/image-detail.test.ts`

現状はサイズ検証なし。E2E では新規画像登録は通常困難なので、既存登録 (CI placeholder env では空のためスキップ) を前提にする検証は追加しない。今回は変更不要。

### 4. ドキュメント

- `docs/product-requirements.md:91` — 「合成後の画像をWebP形式に変換し、**幅1200px以内**にリサイズしてVercel Blobに保存する」を「合成後の画像をWebP形式に変換し、**266×199 に中央クロップして** Vercel Blobに保存する」に書き換え
- `docs/functional-design.md`
  - L272 「LGTM文字合成 + WebP変換 + 幅1200px以内へリサイズ」→ 「LGTM文字合成 + WebP変換 + 266×199 中央クロップ」
  - L439 「リサイズ」表記をそのまま (シーケンス図上は概念的でOK) または「266×199 中央クロップ」と明記
  - L514-522 サンプルコードを 266×199 中央クロップ版に差し替え
  - L740 「合成画像のメタデータ検証（WebP形式、幅1200px以内）」→ 「合成画像のメタデータ検証（WebP形式、266×199 固定）」
- `docs/architecture.md` — Sharp の役割表記に変更不要 (「リサイズ」は包含する概念)

## リスクと対応

| リスク | 影響 | 対応 |
|---|---|---|
| 既存の 1200px 系画像と新画像の DB 上での `width`/`height` が混在 | 詳細ページで両者が混在するが、`max-w-[266px]` のコンテナで視覚的に揃う | 受け入れ (issue 仕様通り、再合成は別 issue) |
| pHash 計算が出力ではなく元画像 buffer に対して行われている | 仕様変更で重複判定ロジックが変わらない | 影響なし (確認済み: `image-service.ts:110`) |
| `image-service.test.ts` の `vi.mock` に `MAX_OUTPUT_WIDTH` 残置 | テストはコンパイルエラーにはならないがモック値が参照されない | `TARGET_WIDTH` / `TARGET_HEIGHT` に書き換え |
| `next/image` の `sizes="266px"` で srcSet が縮退 | 想定通り (大きいサイズ不要) | 受け入れ |

## 検証戦略

1. `npm test` でユニットテスト全パス (sharp による実画像生成テストを含む)
2. `npm run lint` / `npm run typecheck` でクリーン
3. (任意) `npm run dev` で実画像登録し詳細ページが 266×199 表示になることを目視確認 (E2E は CI 環境では実画像登録困難なため任意)
