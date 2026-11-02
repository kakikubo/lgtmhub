import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

export class RateLimitRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * 固定ウィンドウを 1 消費する。上限内なら true、超過なら false。
   * 判定と加算は RPC 内で atomic に行う。
   */
  async consume(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('consume_rate_limit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) throw new DatabaseError(error.message);
    if (typeof data !== 'boolean') {
      throw new DatabaseError('consume_rate_limit が予期しない値を返しました');
    }
    return data;
  }
}
