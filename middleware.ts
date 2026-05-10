import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
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
// `/`, `/images/[id]` など読み取り専用ルートは middleware を通さず Supabase 往復を 1 回減らす (Issue #46)。
// `/api/auth/*` は自前で response cookie を書き換える設計のため middleware は不要。
export const config = {
  matcher: ['/images/new', '/api/images/:path*'],
};
