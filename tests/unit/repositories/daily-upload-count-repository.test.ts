import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DailyLimitExceededError, DatabaseError } from '@/src/lib/errors';
import { DailyUploadCountRepository } from '@/src/repositories/daily-upload-count-repository';
import type { Database } from '@/src/types/database.types';

interface RpcResult {
  data: number | null;
  error: { message: string; code?: string } | null;
}

function createRpcStub(result: RpcResult): SupabaseClient<Database> {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc } as unknown as SupabaseClient<Database>;
}

describe('DailyUploadCountRepository.increment', () => {
  it('RPC が返した新カウントを返す', async () => {
    const supabase = createRpcStub({ data: 4, error: null });
    const repo = new DailyUploadCountRepository(() => supabase);
    expect(await repo.increment('user-1', '2026-05-04')).toBe(4);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: { message: 'rpc failed' } });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('返り値が number でない場合は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: null });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('RPC が daily_limit_exceeded (P0001) を raise した場合は DailyLimitExceededError に変換する', async () => {
    const supabase = createRpcStub({
      data: null,
      error: { message: 'daily_limit_exceeded', code: 'P0001' },
    });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(
      DailyLimitExceededError,
    );
  });

  it('release は RPC エラーを DatabaseError にする', async () => {
    const supabase = createRpcStub({ data: null, error: { message: 'rpc failed' } });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.release('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('release が成功したら例外を出さない', async () => {
    const supabase = createRpcStub({ data: 3, error: null });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.release('user-1', '2026-05-04')).resolves.toBeUndefined();
  });

  it('P0001 でもメッセージが異なる場合は DatabaseError として扱う', async () => {
    const supabase = createRpcStub({
      data: null,
      error: { message: 'something else', code: 'P0001' },
    });
    const repo = new DailyUploadCountRepository(() => supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('DailyUploadCountRepository のクライアント生成', () => {
  it('クライアントは最初の呼び出しで 1 度だけ生成する', async () => {
    const supabase = createRpcStub({ data: 1, error: null });
    const createClient = vi.fn(() => supabase);
    const repo = new DailyUploadCountRepository(createClient);
    expect(createClient).not.toHaveBeenCalled();

    await repo.increment('user-1', '2026-05-04');
    await repo.release('user-1', '2026-05-04');
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('クライアントを生成できない (キー未設定) ときは increment が失敗する', async () => {
    const repo = new DailyUploadCountRepository(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です');
    });
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toThrow(
      'SUPABASE_SERVICE_ROLE_KEY が未設定です',
    );
  });

  it('increment / release は渡されたユーザー ID・日付・上限を RPC に渡す', async () => {
    const supabase = createRpcStub({ data: 1, error: null });
    const repo = new DailyUploadCountRepository(() => supabase);

    await repo.increment('user-1', '2026-05-04', 10);
    await repo.release('user-1', '2026-05-04');
    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'increment_daily_upload_count', {
      p_user_id: 'user-1',
      p_date: '2026-05-04',
      p_max: 10,
    });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'release_daily_upload_count', {
      p_user_id: 'user-1',
      p_date: '2026-05-04',
    });
  });
});
