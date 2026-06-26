# design.md — アニメーション GIF を登録対象に追加する

## 1. バリデーション (`src/lib/image/validate-image.ts`)

### 変更内容

- `metadata.format === 'gif' && metadata.pages > 1` でのアニメ GIF 拒否ブロックを削除する。
- 代わりに **総フレーム数 (= `metadata.pages ?? 1`) > 150 のときは
  `BadRequestError('フレーム数が多すぎます (150 フレーム以下にしてください)')`** を投げる。
  これは GIF のみではなく将来のアニメ PNG / WebP も等しくカバーするよう、
  フォーマット非依存の判定にする (今回の入力は実質 GIF 限定なので副作用は無い)。
- `ValidatedImage` に **`pages: number`** を追加する。後続の合成パイプライン側で
  「アニメーション入力かどうか」を判定するヒントとして使う。
  - `pages` は `metadata.pages ?? 1` で常に 1 以上 (静止画は `1`)。

### 公開 API への影響

- `validateImage(buffer)` / `assertSupportedImageMetadata(metadata)` の戻り値が
  `{ format, width, height }` から `{ format, width, height, pages }` に拡張される。
  これらは現状 `image-service.ts` の `validateImage(buffer)` 呼び出し時に戻り値を
  捨てているため、構造的破壊なし。
- 定数 `MAX_GIF_FRAMES = 150` を export する (テストから参照する)。

## 2. 合成パイプライン (`src/lib/image/compose-lgtm.ts`)

### 設計方針

`sharp(buffer, { animated: true })` は **全フレームを縦に連結した 1 枚の画像** として
扱う点が肝。例: 各フレーム 200×150 の 10 フレーム GIF は `width=200, height=1500,
pageHeight=150, pages=10` として読み込まれる。

- リサイズは長辺 400px に揃えるが、`pageHeight` を保ったまま resize するためには
  **`{ animated: true }` で読み込み続けたまま resize → composite → webp する** だけで
  sharp が自動的に縦タイルを保持してくれる (sharp 公式ドキュメント参照)。
- LGTM オーバーレイは **1 フレーム分の高さ (= pageHeight)** で作って、
  **`tile: true` を使わずに各フレームの位置に手動で repeating composite する**
  か、もしくは sharp の `gif`/`webp` で `tile` モードを使う方法がある。
  最終的に採用するのは前者: composites 配列に `{ input, top: n * pageHeight, left: 0 }`
  を全フレーム分積んでから 1 回 composite を実行する (sharp ベストプラクティス)。

### 変更内容

1. `composeLgtmImage(buffer)` の冒頭で `sharp(buffer).metadata()` を取得し、
   `pages = metadata.pages ?? 1`、`isAnimated = pages > 1` を判定する。
2. **静止画 (`!isAnimated`)** の場合: 既存ロジックそのまま。
3. **アニメーション入力 (`isAnimated`)** の場合:
   - `sharp(buffer, { animated: true }).metadata()` を再取得して
     `pageHeight = metadata.pageHeight` を確定。
   - 元画像 1 フレーム分の width / pageHeight からアスペクト比を計算し、
     長辺 400px に揃えた `targetWidth` / `targetPageHeight` を求める。
   - `sharp(buffer, { animated: true })` で
     `.resize(targetWidth, targetPageHeight, { fit: 'fill' })` を実行する。
     sharp の `{ animated: true }` 入力は **resize の高さを 1 フレーム単位** で
     受け取り、内部で全 pages に同じ変換を適用するため `targetPageHeight * pages`
     ではない (実装と一致させた)。
   - `buildLgtmOverlay(targetWidth, targetPageHeight, 'LGTM')` で
     **1 フレーム分の透明 PNG を 1 枚作る**。
   - composite 配列に `{ input: overlay, top: i * targetPageHeight, left: 0 }`
     を `pages` 個積んで、1 回の `.composite([...])` でまとめて重ねる。
   - `.webp({ quality: WEBP_QUALITY })` で出力する。
     `{ animated: true }` で読み込んだ sharp チェーンに対しては
     `.webp()` がアニメーション WebP を自動的に書き出す。
4. 戻り値 `ComposedImage` に **`isAnimated: boolean`** を追加する
   (DB 保存とテスト判定の両方で利用)。
5. 静止画でも `pageHeight` 概念は無いので、`isAnimated=false` の場合は
   既存の単一フレーム実装を流用し、`isAnimated: false` を返す。

### sharp の挙動メモ

- アニメーション WebP の duration / loop は sharp が元 GIF から自動継承する
  (sharp 0.32+ で実装済み)。明示指定が必要になった場合は `.webp({ loop, delay })`
  を追加する。本 PR では暗黙継承で十分。
- 長辺判定: 横長 GIF (200×150) なら 1 フレーム単位 (= width=200, height=150) の
  アスペクト比でリサイズ判定する。`metadata.height` (= pageHeight × pages)
  を使うと縦長扱いになって誤検知するので NG。

## 3. DB マイグレーション

### ファイル

`supabase/migrations/20260626000000_add_lgtm_images_is_animated.sql` を新規作成する。

### 内容

```sql
-- lgtm_images にアニメーション WebP かどうかを記録するフラグを追加する
alter table public.lgtm_images
  add column is_animated boolean not null default false;

-- 既存行は静止 WebP なので false で確定 (DEFAULT 値で自動付与)
-- インデックスは現時点で不要 (UI バッジ表示は別 Issue で対応)
```

### 型生成

`src/types/database.types.ts` は `supabase gen types` が再生成する想定。
本 PR では手動で `is_animated: boolean` を `lgtm_images.Row` / `Insert` に追加する。

## 4. アプリケーション層の変更

### 4-1. `src/types/image.ts`

`LgtmImage` / `PublicLgtmImage` (一覧 / 詳細レスポンス用) に
**`isAnimated: boolean`** を追加する。

- `PublicLgtmImage.isAnimated` を含めるのは将来 UI バッジで使うためであり、
  本 PR では UI 側で参照しない (= bytes 増は最小)。
- `imageListItemSchema` (zod) にも `isAnimated: z.boolean()` を追加する。

### 4-2. `src/repositories/image-repository.ts`

- `toLgtmImage(row)` に `isAnimated: row.is_animated` を追加。
- `toInsert(input)` に `is_animated: input.isAnimated` を追加。
- `CreateLgtmImageInput` に `isAnimated: boolean` を追加 (required)。

### 4-3. `src/services/image-service.ts`

- `composeLgtmImage(buffer)` の戻り値から `isAnimated` を取得して
  `imageRepo.create({ ...rest, isAnimated })` に渡す。
- それ以外のロジックは変更しない (mime_type は `image/webp` のまま)。

### 4-4. `app/(site)/images/[id]/page.tsx`

- `<Image>` に **`unoptimized={image.isAnimated}`** を追加する。
  Next.js Image Optimizer はアニメ WebP のフレームを 1 枚に潰すため、
  アニメ画像のときだけ最適化をスキップして Vercel Blob の生 URL を使う。
  静止画 (`isAnimated = false`) は引き続き Optimizer のサイズ圧縮 /
  フォーマット選択を活かす (CodeRabbit 指摘で条件化に修正)。
  一覧 (`image-card.tsx`) は既に `unoptimized` 済み。

### 4-5. `app/api/images/route.ts`

ファイルの先頭付近で:

```ts
// アニメ GIF → アニメーション WebP 変換は最大 150 フレーム × sharp 合成で
// 数秒〜十数秒かかることがあるため、Vercel デフォルトの 10 秒では足りない。
// Pro 前提で 60 秒に拡張する (Issue #201)。
export const maxDuration = 60;
```

を追加する。`POST` ハンドラ自体のロジックは変更しない。

## 5. テスト

### 5-1. `tests/unit/lib/image/validate-image.test.ts`

- 既存の「アニメーション GIF (pages > 1) を拒否する」テストは **削除する**。
- 追加:
  - アニメ GIF (pages = 5) を受理し、`pages: 5` を返す。
  - 151 フレーム以上の GIF metadata を拒否する (`assertSupportedImageMetadata`
    に `pages: 151` を渡して `BadRequestError` を期待)。
  - 静止画 PNG の戻り値に `pages: 1` が含まれる。

### 5-2. `tests/unit/lib/image/compose-lgtm.test.ts`

- 既存の静止画系テストはそのまま流用 (戻り値の `isAnimated: false` を追加検証)。
- 追加:
  - sharp で 3 フレームの GIF を生成 → `composeLgtmImage` に渡す → 戻り値の
    sharp metadata を再評価し、
    - `meta.format === 'webp'`
    - `meta.pages === 3`
    - `meta.width === expectedWidth`
    - `result.isAnimated === true`
    を満たすことを検証。
  - 151 フレーム以上は `composeLgtmImage` が `BadRequestError` を throw する
    (validate-image と二重防御)。

### 5-3. `tests/unit/services/image-service.test.ts`

- `composeLgtmImage` モックの戻り値に `isAnimated: false` (デフォルト) を追加。
- アニメ入力のシナリオを 1 ケース追加: `composeLgtmImage` が `isAnimated: true`
  を返すと `imageRepo.create` に `isAnimated: true` が渡る。

### 5-4. e2e

- 既存 `image-register.test.ts` は未ログイン経路のみで合成パスは触らないため
  変更不要。
- 動作確認は `npm run dev` 起動下で手動で実施する想定 (CI への組み込みは別 PR)。

## 6. 互換性 / リスク

- **既存 `lgtm_images` 行**: DEFAULT false で埋まる。データ整合性 OK。
- **`PublicLgtmImage.isAnimated` を required にする影響**: 一覧 / 詳細 API
  のレスポンス JSON に `isAnimated` が増えるだけ。既存クライアント
  (= 自前 React コンポーネント) は未知フィールドを無視するので破壊なし。
- **sharp のフレーム展開メモリ**: 150 フレーム × 400×400 × 4ch = 約 96MB の
  中間バッファ。Vercel Functions のデフォルトメモリ (1024MB) 内に余裕で収まる。
- **エンコード時間**: ローカル計測 (Apple M3 / 150 フレーム / 400×400) で
  sharp 0.34 が約 6 秒。Pro の `maxDuration = 60` で十分。
