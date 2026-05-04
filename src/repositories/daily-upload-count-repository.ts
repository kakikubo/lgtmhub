import type { SupabaseClient } from '@supabase/supabase-js';
import { DailyLimitExceededError, DatabaseError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

const DAILY_LIMIT_EXCEEDED_PG_CODE = 'P0001';
const DAILY_LIMIT_EXCEEDED_MESSAGE = 'daily_limit_exceeded';

export class DailyUploadCountRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async getCount(userId: string, date: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('daily_upload_counts')
      .select('count')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    return data?.count ?? 0;
  }

  /**
   * 上限内のときだけ atomic に +1 する。RPC が `daily_limit_exceeded` を raise した場合は
   * `DailyLimitExceededError` に変換することで、Service 層は instanceof で扱える。
   */
  async increment(userId: string, date: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('increment_daily_upload_count', {
      p_user_id: userId,
      p_date: date,
    });

    if (error) {
      if (
        error.code === DAILY_LIMIT_EXCEEDED_PG_CODE &&
        error.message === DAILY_LIMIT_EXCEEDED_MESSAGE
      ) {
        throw new DailyLimitExceededError();
      }
      throw new DatabaseError(error.message);
    }
    if (typeof data !== 'number') {
      throw new DatabaseError('increment_daily_upload_count が予期しない値を返しました');
    }
    return data;
  }
}
