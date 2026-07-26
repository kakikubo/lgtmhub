import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/src/lib/supabase/anon';
import { buildImageService, type ListImagesResult } from '@/src/services/image-service';

export const HOME_IMAGES_CACHE_TAG = 'lgtm-images:list';

/**
 * トップページ初期表示用の画像一覧 (cursor 無し / デフォルト limit) をタグ付きでキャッシュする。
 * 投稿/削除時に `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')` で破棄する。
 * cursor 付き (LoadMoreButton 経由) はキャッシュ対象外。
 *
 * `'use cache'` 配下では `cookies()` を呼べない (= Cookie 連携の `createServerClient` は使えない) ため、
 * Cookie に依存しない `createAnonClient` を採用する。RLS の `"anyone can view active images"` ポリシーで
 * anon ロールから `status='active'` の SELECT が許可されている。
 *
 * `cacheLife('max')` でキャッシュ寿命を最長に設定し、無効化は `revalidateTag` の明示呼び出しに委ねる。
 */
export async function getHomeImagesInitial(): Promise<ListImagesResult> {
  'use cache';
  cacheTag(HOME_IMAGES_CACHE_TAG);
  cacheLife('max');

  const supabase = createAnonClient();
  return buildImageService(supabase).listImages();
}
