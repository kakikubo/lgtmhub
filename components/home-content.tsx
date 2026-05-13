import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { signInWithGithub } from '@/src/lib/auth/actions';
import { getHomeImagesInitial } from '@/src/lib/cache/list-home-images';
import { createClient } from '@/src/lib/supabase/server';
import { buildUserProfileService } from '@/src/services/user-profile-service';
import type { PublicLgtmImage } from '@/src/types/image';
import type { UserProfile } from '@/src/types/user';

function EmptyState({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div
      data-testid="image-list-empty"
      className="rounded border border-dashed bg-gray-50 px-6 py-12 text-center text-sm text-gray-600"
    >
      <p>まだ画像がありません。</p>
      {isLoggedIn ? (
        <p className="mt-2">最初の LGTM 画像を登録してみましょう。</p>
      ) : (
        <p className="mt-2">GitHub でログインすると、画像を登録できます。</p>
      )}
    </div>
  );
}

function LoadErrorState() {
  return (
    <div
      data-testid="image-list-error"
      className="rounded border border-dashed border-amber-300 bg-amber-50 px-6 py-12 text-center text-sm text-amber-800"
    >
      <p>現在画像を読み込めません。</p>
      <p className="mt-2">時間をおいて再度お試しください。</p>
    </div>
  );
}

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
  // 取得失敗時は空 Map にフォールバックし、各カードは Unknown 表示で graceful degrade する。
  const profileMap = await fetchUploaderProfileMap(supabase, images);

  return (
    <>
      {user ? null : (
        <p className="text-sm text-gray-600">
          画像の閲覧とマークダウンのコピーはログイン不要です。 画像を登録するには GitHub
          でログインしてください。
        </p>
      )}

      {loadError ? (
        <LoadErrorState />
      ) : images.length === 0 ? (
        <EmptyState isLoggedIn={!!user} />
      ) : (
        <>
          <ImageGrid images={images} profiles={profileMap} />
          {nextCursor ? <LoadMoreButton initialCursor={nextCursor} /> : null}
        </>
      )}

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

async function fetchUploaderProfileMap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  images: PublicLgtmImage[],
): Promise<Map<string, UserProfile>> {
  if (images.length === 0) return new Map();

  const profiles = await buildUserProfileService(supabase)
    .findManyByIds(images.map((image) => image.uploaderId))
    .catch((err: unknown) => {
      console.error('[HomePage] failed to fetch uploader profiles', err);
      return [];
    });

  return new Map(profiles.map((profile) => [profile.id, profile]));
}
