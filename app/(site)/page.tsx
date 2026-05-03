import { signInWithGithub } from '@/src/lib/auth/actions';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import { createClient } from '@/src/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user ? await new UserProfileRepository(supabase).findById(user.id) : null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-12 space-y-4">
      <h2 className="text-2xl font-bold">LGTMHub</h2>
      {profile ? (
        <p className="text-sm text-gray-700">
          ようこそ <strong>{profile.displayName}</strong> さん。LGTM 画像の登録機能は次の機能追加で実装予定です。
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            画像の閲覧とマークダウンのコピーはログイン不要です。画像を登録するには GitHub でログインしてください。
          </p>
          <form action={signInWithGithub}>
            <button
              type="submit"
              className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              ログインして登録
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
