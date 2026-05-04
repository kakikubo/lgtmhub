import { signInWithGithub } from '@/src/lib/auth/actions';
import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';

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

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { images, nextCursor } = await buildImageService(supabase).listImages();

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

      {images.length === 0 ? (
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
