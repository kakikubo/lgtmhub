# design.md — 一覧画面にランダム表示機能 (Issue #109)

## 1. ランダム抽出方式の選定

Issue の技術検討事項 (RPC `order by random()` / `tablesample` / ID 一覧取得後
サンプリング) を比較し、**「全 active ID 取得 → サーバーで Fisher-Yates
シャッフル → 先頭 N 件の本体を取得」** を採用する。

| 方式 | 採否 | 理由 |
|---|---|---|
| RPC `order by random() limit 16` | ✗ | 新規 migration + `supabase gen types` が必要。本環境では Supabase Local を起動できず `database.types.ts` の再生成不可。型を手書きすると生成物との乖離リスク。影響範囲が DB/RLS/型に拡大する。 |
| `tablesample` | ✗ | 抽出件数が確率的で「ちょうど 16 枚」を保証しにくい。 |
| **ID 一覧 → サンプリング** | ✓ | TS のみで完結 (migration / 型再生成不要)。既存 `listActivePHashes()` が全 active 行の `id, p_hash` (p_hash は 1024 文字) を select している前提と比べ、`id` のみの全件取得は遥かに軽量で、現行のデータ規模前提と整合。サーバー (Route Handler) でシャッフルするため「サーバーサイドでランダム抽出」の要件を満たす。 |

CLAUDE.md「シンプル第一 / 影響を最小限」に最も合致する。データ規模が
10 万件級に達した場合は RPC + pgvector 同様に migration ベースへ移行を検討
(architecture.md の pHash 全件比較と同じ判断基準)。

## 2. レイヤー別変更

### 2.1 Repository (`src/repositories/image-repository.ts`)

- `listActiveIds(): Promise<string[]>`
  - `select('id').eq('status','active')` → `row.id[]`
  - error 時 `DatabaseError`
- `findManyActiveByIds(ids: string[]): Promise<LgtmImage[]>`
  - `ids` 空なら Supabase を呼ばず `[]` を返す (ガイドライン 124-125: Service/
    Repository 両層に空配列ガード)
  - `select('*').eq('status','active').in('id', ids)` → `toLgtmImage` map
  - error 時 `DatabaseError`
  - `.in` の返却順は不定。表示順 (ランダム) は Service 側で再整列する。

### 2.2 Service (`src/services/image-service.ts`)

- `RandomImagesResult { images: PublicLgtmImage[] }` (nextCursor を持たない =
  「もっと読み込む」非表示を型レベルで構造化)
- `listRandomImages(limit = LIST_IMAGES_DEFAULT_LIMIT): Promise<RandomImagesResult>`
  1. `ids = imageRepo.listActiveIds()`
  2. `ids` 空 → `{ images: [] }`
  3. Fisher-Yates で `ids` をシャッフルし先頭 `limit` 件を採用
  4. `rows = imageRepo.findManyActiveByIds(sampled)`
  5. `sampled` の順序で `rows` を整列 (Map で引く)。シャッフル順を表示順に反映
  6. `toPublic` で公開フィールドへ絞り込み
- `limit` は引数デフォルトで `LIST_IMAGES_DEFAULT_LIMIT` を参照 (ハードコード禁止)。
- シャッフルは `Math.random` の Fisher-Yates。暗号強度は不要 (表示多様化目的)。

### 2.3 API Route (`app/api/images/random/route.ts`)

- `GET` のみ。`createClient()` (既存 GET /api/images と同様、RLS
  「anyone can view active images」経由で anon SELECT 可)。
- `service.listRandomImages()` を呼び `{ images }` を 200 で返す。
- **キャッシュ無効化**: 再押下で別の 16 枚を返す要件のため
  `export const dynamic = 'force-dynamic'` を宣言し、`NextResponse` に
  `Cache-Control: no-store` を設定。クライアントも `fetch(..., {cache:'no-store'})`。
- 例外時は GET /api/images と同じく `console.error` + 500
  `{ error: 'サーバーエラーが発生しました' }`。

### 2.4 Validation (`src/lib/validation/image.ts`)

- 既存 `listImagesResponseSchema` の image item を共通スキーマ
  `imageListItemSchema` として抽出 (DRY、挙動不変)。
- `randomImagesResponseSchema = z.object({ images: z.array(imageListItemSchema) })`
  と `RandomImagesResponse` 型を追加。

### 2.5 UI

現状 `HomeContent` (Server Component) が初期 16 枚 + profiles + LoadMoreButton を
描画。ボタンは「グリッドより上に常時表示」かつ「押下でグリッドをランダムへ差し替え /
リロードで通常へ自動復帰」が必要 → クライアント状態が要る。

- 新規 `components/home-images.tsx` (`'use client'`)
  - props: `initialImages: PublicLgtmImage[]`, `initialProfiles: UserProfile[]`,
    `initialNextCursor: string | null`, `loadError: boolean`
  - `UserProfile[]` を受け取りクライアントで `Map` を再構築 (Map を RSC 境界に
    渡さず、確実にシリアライズ可能な配列で受け渡す)
  - state: `mode: 'default' | 'random'`, `randomImages`, `loading`, `error`
  - 先頭に「ランダム表示」ボタン (常時表示, `data-testid="random-button"`)
  - 本体:
    - `loadError` → 既存 `LoadErrorState`
    - `mode==='default'`:
      `images` 空 → `EmptyState` / それ以外 →
      `<ImageGrid images profiles />` + `initialNextCursor` があれば
      `<LoadMoreButton />`
    - `mode==='random'`: ランダム fetch 中 `loading` 表示、結果空 →
      `EmptyState`、それ以外 → `<ImageGrid images={randomImages} />`
      (**LoadMoreButton を描画しない**)。`error` 時はメッセージ表示。
  - `EmptyState` / `LoadErrorState` は `home-images.tsx` へ移動 (ボタンを
    常に上部へ置くため UI を 1 コンポーネントへ集約)。presentational なので
    client でも問題ない。
  - ランダム結果グリッドは `LoadMoreButton` の追加グリッドと同じく profiles
    無しで描画 (既存前例に倣い最小構成)。`testId` は `image-grid` を維持し、
    既存 E2E のグリッド検出と矛盾させない。
- `components/home-content.tsx` (Server Component, 変更)
  - 画像/プロフィール/nextCursor/loadError/user の取得は現状維持
  - `profileMap` → `Array.from(profileMap.values())` で `UserProfile[]` 化
  - 未ログイン誘導文・「ログインして登録」ボタン (user 依存, server) は従来位置
  - 中央の一覧描画を `<HomeImages ... />` に置換

## 3. 受け入れ条件 ↔ 設計の対応

| 受け入れ条件 | 対応 |
|---|---|
| 先頭にボタン表示 | `HomeImages` 先頭の常時表示ボタン |
| 押下で全 active からランダム 16 | `/api/images/random` → `listRandomImages()` (全 ID → shuffle → 16) |
| 再押下で別の 16 | 毎回サーバーで再シャッフル + no-store |
| ランダム中に「もっと読み込む」非表示 | `mode==='random'` で LoadMoreButton 非描画。`RandomImagesResult` に nextCursor 無し |
| リロードで通常表示へ | state はクライアントメモリのみ。SSR は常に default |
| 件数が共通定数参照 | `listRandomImages(limit = LIST_IMAGES_DEFAULT_LIMIT)` |
| E2E 追加 | `tests/e2e/image-list.test.ts` に describe 追加 |

## 4. テスト方針

- 単体: `image-repository.test.ts` に `listActiveIds` / `findManyActiveByIds`
  (空配列ガード含む) を追加。`image-service.test.ts` に `listRandomImages`
  (空 / limit 切り詰め / 整列 / デフォルト limit=16) を追加。
- バリデーション: `tests/unit/lib/validation/image.test.ts` に
  `randomImagesResponseSchema` を追加。
- E2E (`tests/e2e/image-list.test.ts`): seed 画像が無い環境でも安定するよう、
  既存テストの `grid.or(empty).or(error)` 耐性パターンに倣う。
  - ボタンが常に可視であること (決定的)
  - 押下後、ランダムモードで `load-more-button` が出ないこと
  - 再押下してもクラッシュせずグリッド/empty が表示されること

## 5. リスクと緩和

- 全 ID 取得のコスト: 現データ規模では軽微 (既存 `listActivePHashes` がより重い
  全件 select を実施済み)。規模拡大時は migration ベース RPC へ移行 (本 design
  に判断基準を明記)。
- Map の RSC シリアライズ回避: `UserProfile[]` で受け渡し client で再構築。
- 既存 E2E への影響: ランダムグリッドの `testId` を `image-grid` のまま維持し、
  初期表示パスの DOM 構造・testid を変更しない。
