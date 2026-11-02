'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';

function buildOrigin(headerList: Headers): string {
  const origin = headerList.get('origin');
  if (origin) return origin;

  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const host = headerList.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

export async function signInWithGithub(): Promise<void> {
  const supabase = await createClient();
  const headerList = await headers();
  const origin = buildOrigin(headerList);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/?auth_error=signin_failed');
  }

  redirect(data.url);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
