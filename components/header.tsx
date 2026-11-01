import Image from 'next/image';
import Link from 'next/link';
import { signInWithGithub, signOut } from '@/src/lib/auth/actions';
import { createClient } from '@/src/lib/supabase/server';
import { buildUserProfileService } from '@/src/services/user-profile-service';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Header は (site)/layout.tsx に置かれ、同階層の error.tsx では捕捉できない (Issue #373)。
  // 取得失敗で全ページを落とさないよう、未ログイン相当の表示へ degrade する
  const profile = user
    ? await buildUserProfileService(supabase)
        .findById(user.id)
        .catch((err: unknown) => {
          console.error('[Header] failed to load user profile', err);
          return null;
        })
    : null;

  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          LGTMHub
        </Link>
        <div>
          {profile ? (
            <div className="flex items-center gap-3">
              {/* お気に入りはユーザーごとの非公開リストなので、ログイン時のみ導線を出す (Issue #198) */}
              <Link
                href="/favorites"
                data-testid="header-favorites-link"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                お気に入り
              </Link>
              <Link
                href="/images/new"
                data-testid="header-register-link"
                className="text-sm text-gray-700 hover:text-gray-900"
              >
                画像を登録する
              </Link>
              <form action={signOut} className="flex items-center gap-3">
                {profile.avatarUrl ? (
                  <Image
                    src={profile.avatarUrl}
                    // 直後に表示名のテキストがあるため装飾扱いにし、二重読み上げを避ける
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : null}
                <span className="text-sm">{profile.displayName}</span>
                <button type="submit" className="text-sm text-gray-600 hover:text-gray-900">
                  ログアウト
                </button>
              </form>
            </div>
          ) : (
            <form action={signInWithGithub}>
              <button
                type="submit"
                className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
              >
                GitHub でログイン
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
