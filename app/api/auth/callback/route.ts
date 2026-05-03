import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

// `next` を相対パス (/ で始まり // で始まらない) に限定し、open redirect を封じる
function safeNext(value: string | null): string {
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'));

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=exchange_failed', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
