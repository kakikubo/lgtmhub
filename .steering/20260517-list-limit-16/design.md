# 設計: 一覧画面の1ページ表示件数を16枚に制限する

## 現状調査の結論

単一の共通定数による参照構造は **既に成立している**。変更は定数値のみで完結する。

```
src/lib/validation/image.ts
  └─ export const LIST_IMAGES_DEFAULT_LIMIT = 20   ← ★ ここを 16 に変更

src/services/image-service.ts:206
  └─ const limit = params.limit ?? LIST_IMAGES_DEFAULT_LIMIT;  ← 定数を参照

初期表示:  src/lib/cache/list-home-images.ts:19
  └─ buildImageService(supabase).listImages()      ← 引数なし = デフォルト limit

もっと読み込む: app/api/images/route.ts:35
  └─ service.listImages(parsed.data)                ← limit 未指定時 = デフォルト limit
```

両経路とも `LIST_IMAGES_DEFAULT_LIMIT` に集約されているため、定数を 16 にするだけで
初期表示・API デフォルトの双方が 16 件になる。`nextCursor` 算出ロジック
（`records.length === limit` 判定）は limit 非依存で正しく動作する。

## 変更方針（影響最小）

### 1. 定数の変更（本体）
- `src/lib/validation/image.ts:14`: `LIST_IMAGES_DEFAULT_LIMIT = 20` → `= 16`

### 2. 単体テストの期待値更新
- `tests/unit/lib/validation/image.test.ts:52`: `toBe(20)` → `toBe(16)`
- `tests/unit/services/image-service.test.ts`:
  - test タイトル `limit 未指定なら 20 件で…` → `16 件で…`
  - `expect(...).toHaveBeenCalledWith({ cursor: undefined, limit: 20 })` → `limit: 16`
  - コメント `limit (20) ちょうどでないので` → `limit (16)`

### 3. E2E テスト
- `tests/e2e/image-list.test.ts` は件数を `grid.locator('li').count()` で動的取得しており、
  20 をハードコードしていない。**変更不要**（受け入れ条件「必要なら更新」に該当せず）。

### 4. 永続ドキュメントの整合
- `docs/functional-design.md:627`: `// デフォルト 20、最大 50` → `デフォルト 16`
- `docs/product-requirements.md:173`: `1ページあたり最大20件` → `16件`
- `docs/product-requirements.md:263` / `docs/architecture.md:143`:
  パフォーマンス指標「画像一覧の初期表示（20件）」→「（16件）」

## 検証方針

- `npm test` / `npm run lint` / `npm run typecheck` を全てパス。
- 単体テストで定数値・サービス呼び出し limit を担保（E2E は環境依存のため CI で実行）。
