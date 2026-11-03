import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/database.types';

/**
 * Cookie に依存しない anon ロールの Supabase クライアントを生成する。
 *
 * `unstable_cache` 配下など「`cookies()` を呼んではいけないスコープ」から
 * RLS 公開データ (`status='active'` の画像など) を読み取る用途で使う。
 *
 * 認証情報を持たないため、authenticated ユーザー固有の操作には使わないこと。
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}
