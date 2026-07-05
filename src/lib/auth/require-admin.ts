import type { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, UnauthorizedError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

export interface AdminContext {
  userId: string;
}

/**
 * 認証 + `user_profiles.is_admin = true` を要求する共通ゲート。
 *
 * - 未ログイン → UnauthorizedError (呼び出し元で 401 に変換)
 * - 認証済みだが is_admin=false / user_profiles 行が無い / SELECT エラー → ForbiddenError (403)
 *
 * 管理者判定に失敗した場合はすべて Forbidden に倒す (「識別できないなら管理者ではない」)。
 * 将来の管理者専用機能 (PRD 機能6 の管理者削除など) と共有する土台。
 */
export async function requireAdmin(supabase: SupabaseClient<Database>): Promise<AdminContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new ForbiddenError();
  if (data?.is_admin !== true) throw new ForbiddenError();
  return { userId: user.id };
}
