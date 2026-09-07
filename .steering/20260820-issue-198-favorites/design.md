# 設計書

## アーキテクチャ概要

既存の画像機能と同じ `app → src/services → src/repositories` の単方向レイヤー構成を踏襲する。
`ImageService` / `ImageRepository` のパターンをそのまま写し、`FavoriteService` / `FavoriteRepository` を新設する。

```
app/(site)/favorites/page.tsx ─┐
components/favorite-button.tsx ┤          ┌─ FavoriteService ─┬─ FavoriteRepository ─ favorites
components/favorite-store.ts   ┴─ app/api/favorites/*  ────────┴─ ImageRepository ──── lgtm_images
```

- Route Handler: 認証チェック → zod バリデーション → service 呼び出し → エラー変換のみ（`app/api/CLAUDE.md`）。
- Service: ビジネスルール（画像の存在確認・重複判定・カーソル計算）。`NextResponse` を知らない。
- Repository: Supabase クエリと snake_case ↔ camelCase 変換のみ。

## コンポーネント設計

### 1. マイグレーション `supabase/migrations/20260820000000_create_favorites.sql`

**責務**:
- `public.favorites` テーブル作成（`id` / `user_id` / `lgtm_image_id` / `created_at`）
- `(user_id, lgtm_image_id)` UNIQUE 制約
- 一覧クエリ用インデックス `(user_id, created_at desc)`
- RLS 有効化 + SELECT / INSERT / DELETE の 3 ポリシー（すべて `auth.uid() = user_id`）

**実装の要点**:
- `lgtm_images` と同じく FK は `on delete cascade`。画像が物理削除されてもお気に入りが孤児にならない。
- UPDATE ポリシーは作らない。お気に入りは「作る / 消す」しかなく、更新の余地がない。
- `20260720000000_restrict_user_profiles_column_grants.sql` と同様、テーブル権限も最小化する。
  `favorites` は全カラムがユーザー由来の値ではない（`id` / `created_at` は default 生成）ため、
  `insert (user_id, lgtm_image_id)` のみを `authenticated` に GRANT し、`update` は付与しない。
- 適用後 `pnpm run db:reset` → `pnpm run db:types` で `database.types.ts` を再生成し同一コミットに含める。

### 2. `src/types/favorite.ts`

**責務**: ドメイン型の定義。

```typescript
export interface Favorite {
  id: string;
  userId: string;
  lgtmImageId: string;
  createdAt: Date;
}
```

一覧 API は「お気に入り登録日時を `createdAt` として返す画像」を扱うため、`PublicLgtmImage` を再利用する
（`createdAt` に `favorites.created_at` を詰める）。これによりカード / グリッドの既存コンポーネントを無改造で流用できる。

### 3. `src/lib/validation/favorite.ts`

**責務**: リクエスト / レスポンスの zod スキーマ（`src/lib/validation/image.ts` と同じパターン）。

- `createFavoriteRequestSchema` = `{ lgtmImageId: uuid }`
- `favoriteImageIdParamSchema` = `{ lgtmImageId: uuid }`（DELETE の path param）
- `listFavoritesQuerySchema` = `{ cursor?: ISO8601, limit?: 1..50 }`、既定 `LIST_FAVORITES_DEFAULT_LIMIT = 20`
- `createFavoriteResponseSchema` = `{ id, lgtmImageId }`
- `listFavoritesResponseSchema` = `{ images: imageListItemSchema[], nextCursor: string | null }`（`image.ts` の `imageListItemSchema` を再利用）
- `favoriteImageIdsResponseSchema` = `{ lgtmImageIds: string[] }`

### 4. `src/repositories/favorite-repository.ts`

**責務**:
- `create(userId, lgtmImageId): Promise<Favorite>` — UNIQUE 違反（PostgreSQL `23505`）を `DuplicateFavoriteError` に変換
- `delete(userId, lgtmImageId): Promise<number>` — 削除行数を返す（0 = 未登録）
- `listWithImages({ userId, cursor, limit })` — `lgtm_images` を JOIN し `status='active'` に絞る
- `listImageIds(userId)` — 自分のお気に入り画像 ID 一覧

**実装の要点**:
- JOIN は PostgREST の埋め込み構文 `select('id, created_at, lgtm_images!inner(...)')` を使う。
  `!inner` にすることで `lgtm_images.status='active'` のフィルタが内部結合として効き、
  論理削除済み画像の行自体が返らない（left join だと `null` 行が残る）。
- 埋め込み結果の型は Supabase の型生成では配列に推論されうるため、`Database` 型から組み立てた
  明示的な row 型で受け、`toPublicImage` で camelCase に変換する。
- 並び順は `favorites.created_at desc`。カーソルは `lt('created_at', cursor)`（`ImageRepository.list` と同型）。

### 5. `src/services/favorite-service.ts`

**責務**:
- `addFavorite(userId, lgtmImageId): Promise<Favorite>`
  1. `ImageRepository.findActiveById` で対象画像の存在（かつ active）を確認 → 無ければ `NotFoundError`
  2. `FavoriteRepository.create` → UNIQUE 違反は `DuplicateFavoriteError`
- `removeFavorite(userId, lgtmImageId): Promise<void>` — 削除行数 0 なら `NotFoundError`
- `listFavorites({ userId, cursor, limit })` — `ImageService.listImages` と同じ nextCursor 計算
- `listFavoriteImageIds(userId): Promise<string[]>`
- `buildFavoriteService(supabase)` ファクトリを提供する（`buildImageService` と同じ形）

**実装の要点**:
- 「先に存在確認 → INSERT」は TOCTOU で競合しうるが、FK 違反（`23503`）も
  `NotFoundError` に倒すことで最終的な整合を取る。

### 6. Route Handler

| ルート | メソッド | 処理 |
|--------|---------|------|
| `app/api/favorites/route.ts` | `POST` | 認証 → body 検証 → `addFavorite` → 201 |
| `app/api/favorites/route.ts` | `GET` | 認証 → query 検証 → `listFavorites` → 200 |
| `app/api/favorites/[lgtmImageId]/route.ts` | `DELETE` | 認証 → param 検証 → `removeFavorite` → 204 |
| `app/api/favorites/ids/route.ts` | `GET` | 認証 → `listFavoriteImageIds` → 200 |

**実装の要点**:
- すべて `createClient()`（cookie 連携）を使う。`/api/images` の GET と違い **ユーザー固有**なので
  `createAnonClient()` は使えず、CDN キャッシュもさせてはいけない。
  明示的に `Cache-Control: private, no-store` を返す。
- エラー変換順序は `app/api/CLAUDE.md` に従い、具体サブクラス → `AppError` の順:
  `DuplicateFavoriteError`→409, `NotFoundError`→404, `UnauthorizedError`→401, `AppError`→500。
- `revalidateTag` は呼ばない。お気に入りは `HOME_IMAGES_CACHE_TAG` が指す公開一覧に影響しない。
- `app/api/favorites/ids/route.ts` と `[lgtmImageId]/route.ts` は同階層に並ぶが、
  Next.js は静的セグメント (`ids`) を動的セグメント (`[lgtmImageId]`) より優先するため衝突しない。

### 7. `components/favorite-store.ts` + `components/favorite-toaster.tsx`（クライアント）

> **実装時の変更**: 当初は `FavoriteProvider`（Context）で `(site)` レイアウトを包む設計だったが、
> クライアントコンポーネントがサーバーコンポーネントの Suspense 境界を包むと、
> ハイドレーション中に一覧・ヘッダーの DOM が約 100ms 二重に存在することが実測で判明した
> （既存 e2e が 7 件壊れる）。ツリーにラッパーを挿さないモジュールスコープのストア +
> `useSyncExternalStore` に変更し、トーストのみ children を包まない葉コンポーネントとして
> レイアウトの兄弟に置く形にした。以下の責務はそのままストアが担う。

#### （当初案）`components/favorite-provider.tsx`（クライアント）

**責務**:
- マウント時に `GET /api/favorites/ids` を 1 回だけ叩き、お気に入り済み ID を `Set` で保持する
- 401 が返れば「未ログイン」と判断して状態を保持する
- `toggle(lgtmImageId)` を提供し、オプティミスティック更新 → API → 失敗時ロールバック + トースト表示
- 最小トースト（`role="status"` の live region）を描画する

**実装の要点**:
- ホーム一覧は `'use cache'` で匿名キャッシュされるため、サーバー側でユーザー固有のハート状態を
  埋め込めない。かつ「もっと読み込む」「ランダム表示」はクライアント fetch でカードを増やす。
  したがってハートの初期状態は **クライアントで一度だけ ID 集合を取得する** 方式が唯一整合する。
- 未ログイン時のトグルは server action `signInWithGithub()` を直接呼んで OAuth へ送る
  （`components/header.tsx` の form action と同じ server action を再利用）。
- Provider は `app/(site)/layout.tsx` で `children` を包む。layout 自身は認証を参照しないため
  cacheComponents 下の静的シェルを壊さない。

### 8. `components/favorite-button.tsx`（クライアント）

**責務**: ハートボタンの描画とトグルの発火。

- `variant='icon'`（カード用・`CopyMarkdownButton` の icon と同じ丸ボタン）と
  `variant='text'`（詳細ページ用・コピーボタンの下に並ぶ横長ボタン）を持つ
- `data-testid="favorite-button"` / `data-favorite-state="on|off"` を出す

### 9. `app/(site)/favorites/page.tsx` + `components/favorites-content.tsx` + `components/favorite-images.tsx`

- `page.tsx`: 見出し + `<Suspense fallback={<ImageGridSkeleton />}>`（トップページと同型）
- `favorites-content.tsx`（サーバー）: 認証確認 → 未ログインならログイン誘導、
  ログイン済みなら `buildFavoriteService(supabase).listFavorites()` で初期ページを取得
- `favorite-images.tsx`（クライアント）: 空状態 / エラー状態 / グリッド + `LoadMoreButton`

**実装の要点**:
- `LoadMoreButton` は現在 `/api/images` 固定なので、`endpoint` prop（既定 `/api/images`）と
  `responseSchema` を差し替え可能にする最小変更を加えて再利用する。
- 解除しても一覧からカードは消さない（輪郭ハートに変わるだけ）。誤操作の取り消しが即座にでき、
  リロードで消えるため状態としても破綻しない。

### 10. `components/header.tsx`

- ログイン時のみ「画像を登録する」の左に `お気に入り` リンク（`data-testid="header-favorites-link"`）を追加する。

## データフロー

### お気に入り登録（カードのハート押下）
```
1. FavoriteButton onClick → favorite-store の toggleFavorite(imageId)
2. 未ログイン (ids fetch が 401 だった) なら signInWithGithub() を呼び OAuth へ
3. Set に imageId を楽観追加 → ハートが即座に塗りつぶしへ
4. POST /api/favorites { lgtmImageId }
5. 201 or 409 (既に登録済み = 望む状態) なら確定
6. それ以外は Set をロールバックし、トーストに「お気に入りの更新に失敗しました」を表示
```

### お気に入り一覧表示
```
1. /favorites を開く → Suspense → FavoritesContent (サーバー)
2. 未ログイン: ログイン誘導を描画して終了
3. FavoriteService.listFavorites({ userId, limit: 20 })
4. FavoriteRepository.listWithImages が favorites × lgtm_images!inner(status='active') を
   created_at desc で limit 件取得
5. limit ちょうどなら nextCursor = 末尾の favorites.created_at
6. FavoriteImages が ImageGrid + LoadMoreButton(endpoint='/api/favorites') を描画
```

## エラーハンドリング戦略

### カスタムエラークラス

`src/lib/errors.ts` に 1 つ追加する:

```typescript
export class DuplicateFavoriteError extends AppError {
  constructor() {
    super('すでにお気に入りに登録されています', 'DUPLICATE_FAVORITE');
    this.name = 'DuplicateFavoriteError';
  }
}
```

### エラーハンドリングパターン

| 状況 | Service | Route | UI |
|------|---------|-------|----|
| 未認証 | - | 401 | ログイン誘導 |
| 画像が存在しない / 削除済み | `NotFoundError` | 404 | ロールバック + トースト |
| 既にお気に入り済み | `DuplicateFavoriteError` | 409 | **成功扱い**（望む状態と一致） |
| 未登録の解除 | `NotFoundError` | 404 | **成功扱い**（冪等・望む状態と一致） |
| DB 障害 | `DatabaseError` | 500 | ロールバック + トースト |

## テスト戦略

### ユニットテスト（vitest）
- `tests/unit/repositories/favorite-repository.test.ts` — create / delete / listWithImages / listImageIds、
  `23505` → `DuplicateFavoriteError`、`23503` → `NotFoundError`、DB エラー → `DatabaseError`
- `tests/unit/services/favorite-service.test.ts` — 画像不在で 404、重複で 409、nextCursor 計算、解除の 0 行
- `tests/unit/api/favorites/create-route.test.ts` / `delete-route.test.ts` / `list-route.test.ts` / `ids-route.test.ts`
- `tests/unit/lib/validation/favorite.test.ts` — スキーマの境界値
- `tests/unit/components/favorite-button.test.tsx` / `favorite-store.test.tsx` —
  楽観更新・ロールバック・トースト・未ログイン誘導
- `tests/unit/components/header.test.tsx`（既存）にお気に入りリンクの表示条件を追記

### e2e（Playwright）
- `tests/e2e/favorites.test.ts`
  - 未ログイン: ヘッダーにお気に入りリンクが出ない / `/favorites` でログイン誘導が出る /
    カードのハートは表示される
  - ログイン済み (`authenticated` プロジェクト): 登録 → `/favorites` に出る → 解除でハートが輪郭に戻る

## 依存ライブラリ

追加なし。`lucide-react`（`Heart`）・`zod` ともに導入済み。

## ディレクトリ構造

```
supabase/migrations/20260820000000_create_favorites.sql   (新規)
src/types/favorite.ts                                     (新規)
src/lib/validation/favorite.ts                            (新規)
src/lib/errors.ts                                         (変更: DuplicateFavoriteError)
src/repositories/favorite-repository.ts                   (新規)
src/services/favorite-service.ts                          (新規)
src/types/database.types.ts                               (再生成)
app/api/favorites/route.ts                                (新規)
app/api/favorites/[lgtmImageId]/route.ts                  (新規)
app/api/favorites/ids/route.ts                            (新規)
app/(site)/favorites/page.tsx                             (新規)
app/(site)/layout.tsx                                     (変更: FavoriteToaster)
components/favorite-store.ts                              (新規: モジュールストア)
components/favorite-toaster.tsx                           (新規: トースト表示の葉コンポーネント)
components/favorite-button.tsx                            (新規)
components/favorites-content.tsx                          (新規)
components/favorite-images.tsx                            (新規)
components/image-card.tsx                                 (変更: ハート追加)
components/load-more-button.tsx                           (変更: endpoint 汎用化)
components/header.tsx                                     (変更: お気に入りリンク)
app/(site)/images/[id]/page.tsx                           (変更: ハート追加)
tests/unit/**                                             (新規 8 ファイル + 既存 1 変更)
tests/e2e/favorites.test.ts                               (新規)
playwright.config.ts                                      (変更: authenticated プロジェクトの testMatch)
docs/*.md                                                 (変更: 未実装注記の解除)
```

## 実装の順序

1. マイグレーション + `db:reset` + `db:types` 再生成
2. 型 / バリデーション / エラークラス
3. Repository → Service（ユニットテスト込み）
4. Route Handler 4 本（ユニットテスト込み）
5. Provider / Button / ページ / ヘッダー導線（コンポーネントテスト込み）
6. e2e
7. 品質チェック（test / check / typecheck / build）
8. docs 更新（未実装注記の解除）

## セキュリティ考慮事項

- RLS で `auth.uid() = user_id` を強制し、他人のお気に入りは読めない・書けない。
- Repository も WHERE 句に `user_id` を必ず含め、RLS とアプリ層の二層で防御する（`ImageRepository.softDelete` と同方針）。
- `favorites` の INSERT は `user_id` / `lgtm_image_id` のカラム GRANT のみ。`id` / `created_at` はクライアントから指定できない。
- `user_id` はリクエストボディから受け取らず、必ず `supabase.auth.getUser()` の結果を使う。
- お気に入り API のレスポンスは `Cache-Control: private, no-store` を明示し、CDN / 共有キャッシュに載せない。

## パフォーマンス考慮事項

- `favorites (user_id, created_at desc)` インデックスで一覧のカーソルページネーションを index scan にする。
- `GET /api/favorites/ids` は「自分のお気に入り件数」に比例する。個人リストなので現実的には数百件規模で、
  1 セッション 1 回の取得なら問題ない。件数が肥大化したら「表示中の画像 ID を渡して絞る」方式へ切り替える。
- 一覧は JOIN 1 回で画像本体まで取得し、N+1 を作らない。

## 将来の拡張性

- お気に入り数の公開・人気順ランキング（別 Issue）は `favorites` への集計クエリで実現できる。
  ただし現行 RLS は本人しか SELECT できないため、集計用の security definer 関数か
  マテビューの追加が前提になる。
- 匿名 localStorage お気に入りとのマージ（別 Issue）は `FavoriteService.addFavorite` の
  バルク版を足す形で拡張できる。
