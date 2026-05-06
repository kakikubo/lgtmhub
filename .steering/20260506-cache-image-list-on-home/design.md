# 設計: トップページ画像一覧の Supabase 問い合わせをキャッシュ化

## アプローチ概要

Next.js 15.5 の `unstable_cache` を使い、**トップページ初期表示用の画像一覧取得関数**をプロセス間で永続化されるキャッシュ層でラップする。タグは `'lgtm-images:list'` を採用し、ミューテーション API (POST / DELETE) の成功時に `revalidateTag` で破棄する。

### なぜ `unstable_cache` か

| 候補 | 採否 | 理由 |
|---|---|---|
| `unstable_cache` | **採用** | Next.js 15 でも安定して利用可能。タグ無効化 (`revalidateTag`) と TTL を両立できる |
| `'use cache'` ディレクティブ | 不採用 | dynamicIO experimental flag が必要で、現状の `next.config.ts` 構成で有効化されていない。導入リスクが高い |
| `React.cache` | 不採用 | リクエスト内 memoize のみ。リクエストを跨いだキャッシュにならず本要件を満たさない |
| `fetch` ベースの cache | 不採用 | Supabase JS SDK は内部で `fetch` を使うが、Supabase 側がキャッシュ可能なヘッダを付けないため `revalidate` が効かない |

## 変更ファイル

### 1. 新規: `src/lib/cache/list-home-images.ts`

トップページ用の「cursor 無し / デフォルト limit」一覧取得をキャッシュする専用関数を切り出す。`unstable_cache` の制約 (引数はシリアライズ可能) を満たすため、SupabaseClient を引数にとらず、関数内部で anon key の client を生成する。

```ts
import { unstable_cache } from 'next/cache';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';
import type { ListImagesResult } from '@/src/services/image-service';

export const HOME_IMAGES_CACHE_TAG = 'lgtm-images:list';

/**
 * トップページの初期表示用の画像一覧 (cursor 無し / デフォルト limit) を
 * タグ付きでキャッシュした上で返す。投稿/削除時に revalidateTag で破棄する。
 *
 * - キャッシュキー: 'home-images-initial' (引数なしの定数キー)
 * - TTL: 60 秒 (タグ破棄漏れ時の最大不整合時間)
 * - スコープ: ログ閲覧者全員で共有 (anon ロール / RLS の active 条件で安全)
 */
export const getHomeImagesInitial = unstable_cache(
  async (): Promise<ListImagesResult> => {
    const supabase = await createClient();
    return buildImageService(supabase).listImages();
  },
  ['home-images-initial'],
  {
    tags: [HOME_IMAGES_CACHE_TAG],
    revalidate: 60,
  },
);
```

### 2. `app/(site)/page.tsx`

`buildImageService(supabase).listImages()` の直接呼び出しを `getHomeImagesInitial()` に置き換える。`auth.getUser()` はそのまま (キャッシュ対象外)。

```diff
-import { createClient } from '@/src/lib/supabase/server';
-import { buildImageService } from '@/src/services/image-service';
+import { createClient } from '@/src/lib/supabase/server';
+import { getHomeImagesInitial } from '@/src/lib/cache/list-home-images';

 export default async function HomePage() {
   const supabase = await createClient();
   const {
     data: { user },
   } = await supabase.auth.getUser();

   let images: PublicLgtmImage[] = [];
   let nextCursor: string | null = null;
   let loadError = false;
   try {
-    const result = await buildImageService(supabase).listImages();
+    const result = await getHomeImagesInitial();
     images = result.images;
     nextCursor = result.nextCursor;
   } catch (err) { ... }
```

### 3. `app/api/images/route.ts` (POST)

投稿成功時に `revalidateTag` を呼ぶ。

```ts
import { revalidateTag } from 'next/cache';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';

// POST 内、createImage 成功直後:
const image = await service.createImage(user.id, parsed.data.imageUrl);
revalidateTag(HOME_IMAGES_CACHE_TAG);
return NextResponse.json({ id: image.id, imageUrl: image.imageUrl }, { status: 201 });
```

### 4. `app/api/images/[id]/route.ts` (DELETE)

削除成功時に `revalidateTag` を呼ぶ。

```ts
import { revalidateTag } from 'next/cache';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';

// DELETE 内、deleteImage 成功直後:
await service.deleteImage(parsed.data.id, user.id);
revalidateTag(HOME_IMAGES_CACHE_TAG);
return new NextResponse(null, { status: 204 });
```

## キャッシュキーとタグの設計

| 項目 | 値 | 理由 |
|---|---|---|
| キー | `['home-images-initial']` | 引数なしの定数。LoadMoreButton 用 (cursor 付き) は別キーにする余地を残すため `home-images-initial` と限定的に命名 |
| タグ | `lgtm-images:list` | `:` 区切りで名前空間を切り、将来 `lgtm-images:detail` などとの衝突を避ける |
| TTL | `revalidate: 60` 秒 | タグ破棄が漏れた場合の最大不整合時間。投稿/削除時は即時破棄されるため通常運用では発生しない |

## アーキテクチャへの影響

- **データフロー**: トップページ → `getHomeImagesInitial` → (cache hit ならここで返す) → `buildImageService(...).listImages()` → Supabase
- **既存ファサードを破壊しない**: `ImageService.listImages` / `ImageRepository.list` の I/F は変更しない。キャッシュ層は外側に薄く被せるだけ
- **副作用**: `unstable_cache` でラップされた関数は内部で `cookies()` / `headers()` を呼ぶと dynamic 化されてしまうため、関数内で生成する `createClient()` 経由でも cookie 参照が起きないことを確認する必要がある (anon ロールで RLS の `active` 条件のみ。ユーザー判定は不要)
  - **備考**: `createClient()` は `cookies()` を内部で呼ぶため、`unstable_cache` 配下から呼ぶと「cookies cannot be cached」のエラーが出る可能性がある。発生した場合は **Cookie に依存しない anon-only Supabase client** を別途用意して使う (例: `@supabase/supabase-js` の `createClient` 直呼び)

## 検討した代替案

### 案 A: `ImageService.listImages` メソッド自体をキャッシュ化

メソッド内で `unstable_cache` を呼ぶ案。**不採用**。`SupabaseClient` インスタンスがキャッシュ関数の引数に紛れ込み、シリアライズキー化に失敗する。クラスのライフサイクルとも噛み合わない。

### 案 B: Server Component 内で直接 `unstable_cache` を使う

`page.tsx` の中で都度 `unstable_cache(() => ...)` を作る案。**不採用**。レンダリングの度に新しいキャッシュ関数が作られ、キーが揃わない。トップレベルの単一エクスポート関数として保持する必要がある。

### 案 C: cursor 付きの一覧もすべてキャッシュ

`unstable_cache` の関数引数に `cursor` / `limit` を渡し、各組み合わせをキャッシュする案。**今回スコープ外**。LoadMoreButton 経由のリクエストは初期表示と比べて頻度が低く、費用対効果が薄い。先に初期表示の効果検証をしてから判断する。

## テスト戦略

- **既存 E2E (`tests/e2e/image-list.test.ts`)**: 引き続き通ること
- **新規ユニットテスト**: 不要 (`unstable_cache` の挙動は Next.js 側の責務、ロジックは「呼び出すだけ」のため)
- **手動シナリオ**:
  1. ローカル `npm run build && npm run start` で起動
  2. トップページ初回アクセス → Vercel Function ログに Supabase REST 1 回出る
  3. 同条件で再アクセス → Supabase REST が出ない (キャッシュヒット)
  4. 画像投稿 → 再アクセスで一覧に出る (revalidateTag が効いている)
  5. 画像削除 → 再アクセスで一覧から消える (revalidateTag が効いている)
- **計測**: Chrome DevTools MCP で TTFB を実装前後で比較

## 既知のリスク / 留意点

- **`createClient()` 内の `cookies()` 呼び出し**: 上記「アーキテクチャへの影響」に書いた通り、`unstable_cache` の制約に抵触する可能性。最初の実装で確認し、問題があれば anon-only client へ切り替える (タスクリストの T1 検証ステップで確認)
- **キャッシュ汚染**: anon key + RLS `status='active'` のみの SELECT のため、ユーザー固有データは含まれない。共有しても安全
- **タグ破棄の漏れ**: アプリ層ミューテーション以外 (admin の SQL 直編集、Supabase ダッシュボードからの手動更新) は revalidate されない。最大 60 秒で TTL により解消する
- **deploy 直後**: キャッシュは新しいデプロイで自動リセットされるため、デプロイ直後の最初の表示は Supabase 1 回往復する (これは想定通りの挙動)
