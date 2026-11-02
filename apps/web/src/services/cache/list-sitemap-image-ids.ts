import { cacheLife, cacheTag } from 'next/cache';
import { createAnonClient } from '@/src/lib/supabase/anon';
import { HOME_IMAGES_CACHE_TAG } from '@/src/services/cache/list-home-images';
import { buildImageService } from '@/src/services/image-service';

/**
 * sitemap 用に全 active 画像の id をキャッシュ付きで返す。
 *
 * 画像の投稿・削除で一覧と同じく内容が変わるため、トップ一覧と同じ
 * `HOME_IMAGES_CACHE_TAG` を付け、既存の `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')`
 * でまとめて破棄させる (新しい無効化経路を増やさない)。
 * `'use cache'` 配下では cookies() を呼べないため anon client を使う。
 */
export async function getSitemapImageIds(): Promise<string[]> {
  'use cache';
  cacheTag(HOME_IMAGES_CACHE_TAG);
  cacheLife('max');

  const supabase = createAnonClient();
  return buildImageService(supabase).listActiveImageIds();
}
