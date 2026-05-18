import { HomeImages } from '@/components/home-images';
import { signInWithGithub } from '@/src/lib/auth/actions';
import { getHomeImagesInitial } from '@/src/lib/cache/list-home-images';
import { createClient } from '@/src/lib/supabase/server';
import { buildUserProfileService } from '@/src/services/user-profile-service';
import type { PublicLgtmImage } from '@/src/types/image';
import type { UserProfile } from '@/src/types/user';

export async function HomeContent() {
  const supabase = await createClient();

  // auth.getUser と画像取得は独立しているため Promise.all で並列化し TTFB を短縮する。
  // 一覧取得失敗 (Supabase 障害 / CI placeholder env など) でページ全体を 500 にせず
  // graceful degrade する (auth.getUser はネットワーク失敗を握りつぶし user=null を返す)
  const [userResult, imagesResult] = await Promise.all([
    supabase.auth.getUser(),
    getHomeImagesInitial().catch((err: unknown) => {
      console.error('[HomePage] failed to list images', err);
      return null;
    }),
  ]);

  const user = userResult.data.user;
  const images: PublicLgtmImage[] = imagesResult?.images ?? [];
  const nextCursor: string | null = imagesResult?.nextCursor ?? null;
  const loadError = imagesResult === null;

  // 投稿者プロフィールは画像一覧に依存するため第 2 段で取得する。
  // N+1 を避けるため findManyByIds をリクエスト内で 1 回のみ呼ぶ (画像ごとに findById を呼ばない)。
  // 取得失敗時は空配列にフォールバックし、各カードは Unknown 表示で graceful degrade する。
  const profiles = await fetchUploaderProfiles(supabase, images);

  return (
    <>
      {user ? null : (
        <p className="text-sm text-gray-600">
          画像の閲覧とマークダウンのコピーはログイン不要です。 画像を登録するには GitHub
          でログインしてください。
        </p>
      )}

      <HomeImages
        initialImages={images}
        initialProfiles={profiles}
        initialNextCursor={nextCursor}
        loadError={loadError}
        isLoggedIn={!!user}
      />

      {user ? null : (
        <form action={signInWithGithub}>
          <button
            type="submit"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            ログインして登録
          </button>
        </form>
      )}
    </>
  );
}

async function fetchUploaderProfiles(
  supabase: Awaited<ReturnType<typeof createClient>>,
  images: PublicLgtmImage[],
): Promise<UserProfile[]> {
  if (images.length === 0) return [];

  return buildUserProfileService(supabase)
    .findManyByIds(images.map((image) => image.uploaderId))
    .catch((err: unknown) => {
      console.error('[HomePage] failed to fetch uploader profiles', err);
      return [];
    });
}
