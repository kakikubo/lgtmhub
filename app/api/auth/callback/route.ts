import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { buildUserProfileService } from '@/src/services/user-profile-service';

// `next` を相対パス (/ で始まり // で始まらない) に限定し、open redirect を封じる
function safeNext(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', request.url));
  }

  // Route Handler では response に cookie を直接書き込む必要があるため、
  // 共用の createClient ではなく専用クライアントを構成する
  const response = NextResponse.redirect(new URL(next, request.url));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=exchange_failed', request.url));
  }

  // GitHub 側で変更されたアバター/表示名を user_profiles に差分同期する (Issue #11)。
  // exchangeCodeForSession が返すユーザーをそのまま使い、getUser の追加往復を避ける。
  // 同期の失敗はログイン自体を阻害しないよう握りつぶし、リダイレクトは必ず返す。
  try {
    const { user } = data;
    if (user) {
      await buildUserProfileService(supabase).syncFromAuth(user.id, user.user_metadata);
    }
  } catch {
    // sync 失敗はログインをブロックしない (将来 Sentry 連携時にここで計測する)
  }

  return response;
}
