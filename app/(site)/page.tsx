import { signInWithGithub } from '@/src/lib/auth/actions';
import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';
import type { PublicLgtmImage } from '@/src/types/image';

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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 一覧取得失敗 (Supabase 障害 / CI placeholder env など) でページ全体を 500 にせず
  // graceful degrade する。auth.getUser がネットワーク失敗を error として握りつぶすのと同じ方針
  let images: PublicLgtmImage[] = [];
  let nextCursor: string | null = null;
  let loadError = false;
  try {
    const result = await buildImageService(supabase).listImages();
    images = result.images;
    nextCursor = result.nextCursor;
  } catch (err) {
    console.error('[HomePage] failed to list images', err);
    loadError = true;
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">LGTM 画像一覧</h1>
        {user ? null : (
          <p className="text-sm text-gray-600">
            画像の閲覧とマークダウンのコピーはログイン不要です。 画像を登録するには GitHub
            でログインしてください。
          </p>
        )}
      </header>

      {loadError ? (
        <LoadErrorState />
      ) : images.length === 0 ? (
        <EmptyState isLoggedIn={!!user} />
      ) : (
        <>
          <ImageGrid images={images} />
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
    </section>
  );
}
