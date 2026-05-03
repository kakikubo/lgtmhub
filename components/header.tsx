import Image from 'next/image';
import Link from 'next/link';
import { signInWithGithub, signOut } from '@/src/lib/auth/actions';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import { createClient } from '@/src/lib/supabase/server';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await new UserProfileRepository(supabase).findById(user.id) : null;

  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          LGTMHub
        </Link>
        <div>
          {profile ? (
            <form action={signOut} className="flex items-center gap-3">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : null}
              <span className="text-sm">{profile.displayName}</span>
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ログアウト
              </button>
            </form>
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
