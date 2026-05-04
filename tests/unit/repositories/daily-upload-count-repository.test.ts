import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DailyLimitExceededError, DatabaseError } from '@/src/lib/errors';
import { DailyUploadCountRepository } from '@/src/repositories/daily-upload-count-repository';
import type { Database } from '@/src/types/database.types';

interface MaybeSingleResult {
  data: { count: number } | null;
  error: { message: string } | null;
}

interface RpcResult {
  data: number | null;
  error: { message: string; code?: string } | null;
}

function createGetCountStub(result: MaybeSingleResult): SupabaseClient<Database> {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eqDate = vi.fn().mockReturnValue({ maybeSingle });
  const eqUser = vi.fn().mockReturnValue({ eq: eqDate });
  const select = vi.fn().mockReturnValue({ eq: eqUser });
  const from = vi.fn().mockReturnValue({ select });
  return { from, rpc: vi.fn() } as unknown as SupabaseClient<Database>;
}

function createRpcStub(result: RpcResult): SupabaseClient<Database> {
  const rpc = vi.fn().mockResolvedValue(result);
  return { from: vi.fn(), rpc } as unknown as SupabaseClient<Database>;
}

describe('DailyUploadCountRepository.getCount', () => {
  it('行が存在する場合は count を返す', async () => {
    const supabase = createGetCountStub({ data: { count: 3 }, error: null });
    const repo = new DailyUploadCountRepository(supabase);
    expect(await repo.getCount('user-1', '2026-05-04')).toBe(3);
  });

  it('行が存在しない場合は 0 を返す', async () => {
    const supabase = createGetCountStub({ data: null, error: null });
    const repo = new DailyUploadCountRepository(supabase);
    expect(await repo.getCount('user-1', '2026-05-04')).toBe(0);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const supabase = createGetCountStub({ data: null, error: { message: 'oops' } });
    const repo = new DailyUploadCountRepository(supabase);
    await expect(repo.getCount('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('DailyUploadCountRepository.increment', () => {
  it('RPC が返した新カウントを返す', async () => {
    const supabase = createRpcStub({ data: 4, error: null });
    const repo = new DailyUploadCountRepository(supabase);
    expect(await repo.increment('user-1', '2026-05-04')).toBe(4);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: { message: 'rpc failed' } });
    const repo = new DailyUploadCountRepository(supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('返り値が number でない場合は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: null });
    const repo = new DailyUploadCountRepository(supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('RPC が daily_limit_exceeded (P0001) を raise した場合は DailyLimitExceededError に変換する', async () => {
    const supabase = createRpcStub({
      data: null,
      error: { message: 'daily_limit_exceeded', code: 'P0001' },
    });
    const repo = new DailyUploadCountRepository(supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(
      DailyLimitExceededError,
    );
  });

  it('P0001 でもメッセージが異なる場合は DatabaseError として扱う', async () => {
    const supabase = createRpcStub({
      data: null,
      error: { message: 'something else', code: 'P0001' },
    });
    const repo = new DailyUploadCountRepository(supabase);
    await expect(repo.increment('user-1', '2026-05-04')).rejects.toBeInstanceOf(DatabaseError);
  });
});
