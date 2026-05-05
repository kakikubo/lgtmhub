import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// E2E テスト時のみ有効化される、email/password での sign-in を許可するエンドポイント。
// 本番ビルドでは E2E_TEST_MODE が undefined のため、即座に 403 を返して機能しない。
// GitHub OAuth 成功パスの session cookie を Playwright globalSetup から立てるためだけに存在する。

const requestBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function isE2ETestMode(): boolean {
  return process.env.E2E_TEST_MODE === 'true';
}

export async function POST(request: NextRequest) {
  if (!isE2ETestMode()) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestBodySchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // Route Handler では response 側に cookie を直接書き込む必要があるため、
  // 共用の createClient ではなく専用クライアントを構成する (callback route と同パターン)
  const response = NextResponse.json({ ok: true });

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

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    // Supabase 由来のメッセージを露出しない (E2E 限定とはいえ "予期しないエラーは内部情報を隠す" 方針に揃える)
    return NextResponse.json({ error: 'signin_failed' }, { status: 401 });
  }

  return response;
}
