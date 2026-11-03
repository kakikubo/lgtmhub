import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from '../global-setup';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[e2e] 環境変数 ${name} が未設定です`);
  return value;
}

/** テストユーザーとしてサインイン済みの Supabase クライアント (authenticated ロール) を返す */
export async function signedInClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(`[e2e] テストユーザーのサインインに失敗: ${error?.message}`);
  }
  return { supabase, userId: data.user.id };
}

/**
 * service_role の Supabase クライアントを返す。
 * lgtm_images の書き込みは service_role 専用 RPC に限られるため、フィクスチャ投入はこれを使う。
 * テーブルへの直接アクセスは Supabase Local の権限差で 42501 になりうるので RPC だけを呼ぶこと。
 */
export function serviceRoleClient(): SupabaseClient {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
