# 設計: 登録画像のサイズを長辺 800px にリサイズ

## 変更点の概要

`composeLgtmImage()` の固定サイズ合成 (266×199 中央クロップ) を、**長辺 800px cap・原画アスペクト比保持・原画 < 800 は拡大しない** 方式に変更する。詳細ページのコンテナ幅も合わせて 800px に拡張する。

## 実装アプローチ

### 1. `src/lib/image/compose-lgtm.ts`

#### 定数の置き換え

```ts
// 変更前
export const TARGET_WIDTH = 266;
export const TARGET_HEIGHT = 199;

// 変更後
export const MAX_LONG_SIDE = 800;
```

`WEBP_QUALITY = 85` は据え置き。

#### `composeLgtmImage()` のロジック

1. `sharp(buffer).metadata()` で原画 W/H を取得 (既存処理を流用)
2. 長辺を求めて scale を計算: `scale = longSide > 800 ? 800 / longSide : 1`
3. 出力 W/H を `Math.round(originalWidth * scale)` / `Math.round(originalHeight * scale)` で確定
4. その出力 W/H で `buildLgtmOverlay(W, H, 'LGTM')` を生成 (LGTM 文字サイズは canvasWidth * 0.15 のまま、画像ごとに可変になる)
5. `sharp(buffer).resize(W, H, { fit: 'fill' })` で確定サイズに揃え、overlay を composite して WebP 出力

`fit: 'fill'` を選ぶ理由: 上で算出した W/H は scale 計算で原画アスペクト比を保持しているため、`fill` でも歪まない。`fit: 'inside'` を使う場合は出力サイズが入力次第となり overlay と合成後のサイズがズレるリスクがあるため、明示的に W/H を指定する `fill` の方が安全。

中央クロップ (`fit: 'cover', position: 'center'`) は撤廃する。

### 2. `app/(site)/images/[id]/page.tsx`

- `<div data-testid="image-detail-image" ...>` の `max-w-[266px]` → `max-w-[800px]`
- `<Image ... sizes="266px" />` → `sizes="(min-width: 768px) 736px, 100vw"`
- `width`/`height` は `image.width`/`image.height` を使う点は据え置き (DB に保存された実サイズが使われる)

### 3. `components/image-card.tsx`

変更なし。`aspect-[4/3] object-cover` を維持し、新旧画像が混在しても CSS 側で中央クロップして表示する。

## テスト戦略

### `tests/unit/lib/image/compose-lgtm.test.ts`

既存 5 ケースを以下のように書き換える:

| 既存テスト | 新テスト |
|---|---|
| 出力は固定 266×199 | 横長 1920×1080 → 800×450、縦横の長辺が 800 |
| アスペクト比違いでも 266×199 | 正方形/横長/縦長それぞれで長辺が 800 になる (`it.each`) |
| 266×199 より小さい原画も拡大される | **削除して逆向きに**: 800 未満の原画は拡大されず原画サイズで保存 (例 600×400 → 600×400) |
| 中央クロップで色サンプル | **削除** (中央クロップしないため意味を失う) |
| 破損した入力は BadRequestError | そのまま維持 |
| フォントファイル同梱 | そのまま維持 |

エクスポート定数を `MAX_LONG_SIDE` に変えるため、テストの import も書き換える。

### `tests/unit/services/image-service.test.ts`

`vi.mock('@/src/lib/image/compose-lgtm', ...)` 内の `TARGET_WIDTH: 266 / TARGET_HEIGHT: 199` を `MAX_LONG_SIDE: 800` に置き換え。`composeLgtmImage` の戻り値スタブ (`width: 800, height: 600`) は元画像のメタデータ用にも使われるため、800 系で問題ないが、念のため値を見直す。

### `tests/e2e/image-detail.test.ts`

サイズ検証は無いため変更不要。

## ドキュメント更新

| ファイル | 変更箇所 |
|---|---|
| `docs/product-requirements.md:91` | 「266×199 に中央クロップして」→「長辺 800px にリサイズ (元アスペクト比保持) して」 |
| `docs/functional-design.md:272/439` | 「266×199 中央クロップ」→「長辺 800px リサイズ (元アスペクト比保持)」 |
| `docs/functional-design.md:512-522` | サンプルコード `TARGET_WIDTH/TARGET_HEIGHT` → `MAX_LONG_SIDE` |
| `docs/functional-design.md:535-538` | リサイズコメント・コードサンプル更新 |
| `docs/functional-design.md:739` | `composeLgtmImage()` の説明更新 |
| `docs/development-guidelines.md:528` | 「266×199 への中央クロップ」→「長辺 800px へのリサイズ (元アスペクト比保持)」 |
| `docs/glossary.md:255` | 「266×199 固定への中央クロップリサイズ」→「長辺 800px リサイズ」 |

## 互換性・リスク

- **Blob URL 互換性**: `composeLgtmImage` 自体の I/F (受け取る引数・返す `ComposedImage`) は変えないため、呼び出し側 (`ImageService`) のロジックは変更不要。
- **既存画像との混在**: 既存 266×199 画像はそのまま DB に保存されており、詳細ページでも `image.width`/`image.height` を使うため新旧サイズが混ざっても破綻しない。トップページグリッドは CSS 側で `aspect-[4/3] object-cover` で揃えているため見た目も問題ない。
- **pHash 互換性**: pHash 計算は元画像 buffer に対して行われており (`src/services/image-service.ts:110`)、合成結果には依存しないため重複検知ロジックは無傷。
- **LGTM 文字サイズの可変**: `buildLgtmOverlay` 内の `fontSize = Math.max(24, Math.floor(canvasWidth * 0.15))` は canvasWidth に応じて変わるため、800×450 では 120px / 600×400 では 90px となり画像ごとに異なるが、既存ロジックの上限・下限は維持されるため画像内バランスは保たれる。

## 動作確認手順

1. 横長 1920×1080 を登録 → 800×450 で保存され、詳細ページで実効 736 幅表示
2. 正方形 1024×1024 を登録 → 800×800 で保存
3. 縦長 800×1200 を登録 → 533×800 で保存
4. 小さい画像 600×400 を登録 → 600×400 のまま保存 (拡大しない)
5. 同じ元画像を 2 回登録 → 重複検知が機能し 409 を返す
6. 既存 266×199 画像が markdown URL のまま閲覧・コピー可能
