import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

// ログイン不要の公開 GET。session refresh を通さない。
// - /api/images: Vercel CDN キャッシュ対象。Set-Cookie が乗ると CDN がキャッシュを諦める (Issue #46 案 #3)
// - /api/images/random: anon クライアントで読むため、Auth 往復と Set-Cookie は無駄になる (Issue #381)
// `/api/images/*` を前方一致で外さず完全一致で列挙するのは、認証付き GET を足したときに
// session refresh が黙って抜けるのを防ぐため。
const PUBLIC_GET_PATHS = new Set(['/api/images', '/api/images/random']);

export async function proxy(request: NextRequest) {
  // Next.js の config.matcher は HTTP method 分岐をサポートしないため proxy 本体で判定する。
  if (request.method === 'GET' && PUBLIC_GET_PATHS.has(request.nextUrl.pathname)) {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });

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

  // session refresh の副作用として cookie を更新する
  await supabase.auth.getUser();

  return response;
}

// 認証必須ルートのみを列挙する allow list 方式。
// `/`, `/images/[id]` など読み取り専用ルートは proxy を通さず Supabase 往復を 1 回減らす (Issue #46)。
// `/api/auth/*` は自前で response cookie を書き換える設計のため proxy は不要。
export const config = {
  matcher: ['/images/new', '/api/images/:path*'],
};
