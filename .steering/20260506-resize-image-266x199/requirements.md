# 要求内容

## 元 issue

[#52 登録画像のサイズを 266×199 にリサイズする](https://github.com/kakikubo/lgtmhub/issues/52)

## 背景・目的

LGTM 画像はマークダウンリンクとして PR / MR コメントに貼られて利用される。現状の合成画像は **幅 1200px 以内** に縮小しているが、PR コメント上で表示が大きく **レビュー UX を妨げる** ケースがある。本作業では合成後の画像物理サイズを **266×199** に統一し、以下を達成する。

- **A. ストレージ・配信コスト削減**: 1200×900 から 266×199 に縮小すると面積比 約 1/20。Vercel Blob・CDN 帯域を大幅に削減
- **C. グリッド表示で実寸活用**: 既存の image-card は `aspect-[4/3]` × `25vw / 33vw / 50vw` で 1080p 25vw ≒ 270px。物理サイズが表示サイズとほぼ一致し、`object-cover` での再縮小ロスがなくなる
- **D. LGTM 文字の物理サイズ統一**: 出力幅が常に 266 に固定されるため、`fontSize = canvasWidth * 0.15 = 39px` で全画像同一の文字サイズになる

## 仕様 (確定事項)

| 項目 | 仕様 |
|---|---|
| 物理ファイルサイズ | **266 × 199 (固定)** |
| 出力フォーマット | WebP (現状維持、`WEBP_QUALITY = 85` も現状維持) |
| アスペクト比違いの処理 | **中央クロップ** (`fit: 'cover'`, `position: 'center'`) |
| 元画像が 266×199 より小さい場合 | **拡大して 266×199 に揃える** (`withoutEnlargement` は付けない) |
| LGTM 文字のサイズ | 既存の `Math.max(24, Math.floor(canvasWidth * 0.15))` を維持 (266 幅で 39px) |
| 詳細ページの表示 | **実寸 266×199** (コンテナを `max-w-[266px] mx-auto` に制限) |
| pHash の互換性 | 元画像 buffer に対して計算しており壊れない (`src/services/image-service.ts:110`) |

## 実装範囲

### コード

- `src/lib/image/compose-lgtm.ts`
  - `MAX_OUTPUT_WIDTH = 1200` を `TARGET_WIDTH = 266 / TARGET_HEIGHT = 199` に置き換え
  - `resize(targetWidth, targetHeight, { fit: 'fill' })` を `resize(266, 199, { fit: 'cover', position: 'center' })` に変更
- `app/(site)/images/[id]/page.tsx`
  - 画像コンテナ `<div data-testid="image-detail-image" ...>` に `max-w-[266px] mx-auto` を追加
  - `sizes` 属性を `"266px"` に変更

### テスト

- `tests/unit/lib/image/compose-lgtm.test.ts` — 既存 5 ケース (1200 ベース) を 266×199 ベースに書き換え
- `tests/unit/services/image-service.test.ts` — `vi.mock` 内の `MAX_OUTPUT_WIDTH: 1200` を新定数に置き換え
- `tests/e2e/image-detail.test.ts` — サイズ検証があれば更新

### ドキュメント

- `docs/product-requirements.md:91` — 「合成後の画像をWebP形式に変換し、**幅1200px以内**にリサイズして Vercel Blob に保存する」を **「266×199 に中央クロップして」** に書き換え
- `docs/functional-design.md`
  - L272 / L439 「リサイズ」表記
  - L514-522 のサンプル `width = 1200` のリサイズ例
  - L740 `composeLgtmImage()` の説明 (「幅1200px以内」)
- `docs/architecture.md` — 「リサイズ」表記の補足が必要なら更新

## スコープ外 (別 issue で対応)

- **既存登録画像の再合成** (1200px 系を 266×199 にダウンサイズ)
- **LGTM 文字サイズ比率 (`* 0.15`) の変更**
- **詳細ページに大画像も保存する 2-Blob 運用**
- **詳細ページのデザイン補強**

## 受け入れ条件

- [ ] 新規登録した画像の物理サイズが必ず 266×199 になっている (DB の `width` / `height` も 266 / 199)
- [ ] 4:3 でない元画像 (1024×1024 / 1920×1080 / 800×1200 等) でも 266×199 にクロップされ、アスペクト比が崩れない
- [ ] 元画像が 266×199 より小さい場合 (例 100×75) でも拡大されて 266×199 になる
- [ ] 既存の 1200px 系画像はそのまま (新仕様で再合成しない)
- [ ] 詳細ページで画像が実寸 266×199 で表示される (コンテナ幅を超えて拡大されない)
- [ ] 重複検知 (pHash) が機能し、新仕様でも既存画像と同一画像なら 409 を返す
- [ ] PRD・機能設計書の数値表記が 266×199 で整合する
- [ ] `npm run lint` / `npm run typecheck` / `npm test` がすべて通る
- [ ] 既存 E2E (`tests/e2e/image-register.test.ts` / `image-list.test.ts` / `image-detail.test.ts`) が通る
