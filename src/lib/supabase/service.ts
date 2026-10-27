import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database.types';

/**
 * service_role の Supabase クライアント。
 *
 * RLS を迂回する。レートリミット RPC のように、anon / authenticated に
 * 実行権限を渡したくないサーバー専用処理でのみ使う。
 * クライアントコンポーネントから import しない。
 */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です');
  }

  return createSupabaseClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
