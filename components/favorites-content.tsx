import { FavoriteImages } from '@/components/favorite-images';
import { signInWithGithub } from '@/src/lib/auth/actions';
import { createClient } from '@/src/lib/supabase/server';
import { buildFavoriteService } from '@/src/services/favorite-service';
import type { PublicLgtmImage } from '@/src/types/image';

function SignInPrompt() {
  return (
    <div data-testid="favorites-signin-prompt" className="space-y-4">
      <p className="text-sm text-gray-600">
        お気に入りはログインしたユーザーごとに保存されます。GitHub
        でログインすると、気に入った画像をここに集められます。
      </p>
      <form action={signInWithGithub}>
        <button
          type="submit"
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          GitHub でログイン
        </button>
      </form>
    </div>
  );
}

/**
 * お気に入り一覧ページの本体 (Issue #198)。
 *
 * Server Component から Service を直呼びする (architecture.md 例外)。
 * 取得失敗時は 500 に倒さず loadError で graceful degrade する (トップページと同方針)。
 */
export async function FavoritesContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <SignInPrompt />;
  }

  const result = await buildFavoriteService(supabase)
    .listFavorites({ userId: user.id })
    .catch((err: unknown) => {
      console.error('[FavoritesPage] failed to list favorites', err);
      return null;
    });

  const images: PublicLgtmImage[] = result?.images ?? [];
  const nextCursor: string | null = result?.nextCursor ?? null;

  return (
    <FavoriteImages
      initialImages={images}
      initialNextCursor={nextCursor}
      loadError={result === null}
    />
  );
}
