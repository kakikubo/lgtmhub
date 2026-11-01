import type { SupabaseClient } from '@supabase/supabase-js';
import { DailyLimitExceededError, DatabaseError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

const DAILY_LIMIT_EXCEEDED_PG_CODE = 'P0001';
const DAILY_LIMIT_EXCEEDED_MESSAGE = 'daily_limit_exceeded';

/**
 * 日次登録カウンタの Repository。
 *
 * increment / release の RPC は service_role だけが実行できる。引数のユーザー ID・日付・上限は
 * そのまま信頼されるため、呼び出し側はセッションで検証済みの値だけを渡すこと。
 * クライアントは最初の呼び出しで生成し、キー未設定なら登録だけを失敗させる。
 */
export class DailyUploadCountRepository {
  private client: SupabaseClient<Database> | null = null;

  constructor(private readonly createClient: () => SupabaseClient<Database>) {}

  private get supabase(): SupabaseClient<Database> {
    this.client ??= this.createClient();
    return this.client;
  }

  /**
   * 上限内のときだけ atomic に +1 する。RPC が `daily_limit_exceeded` を raise した場合は
   * `DailyLimitExceededError` に変換することで、Service 層は instanceof で扱える。
   */
  async increment(userId: string, date: string, max = 10): Promise<number> {
    const { data, error } = await this.supabase.rpc('increment_daily_upload_count', {
      p_user_id: userId,
      p_date: date,
      p_max: max,
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

  /**
   * `increment` で消費した 1 枠を戻す。取得・合成・DB 登録が失敗したときだけ呼ぶ。
   */
  async release(userId: string, date: string): Promise<void> {
    const { error } = await this.supabase.rpc('release_daily_upload_count', {
      p_user_id: userId,
      p_date: date,
    });

    if (error) throw new DatabaseError(error.message);
  }
}
