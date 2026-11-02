import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { RateLimitRepository } from '@/src/repositories/rate-limit-repository';
import type { Database } from '@/src/types/database.types';

function createRpcStub(result: {
  data: boolean | null;
  error: { message: string } | null;
}): SupabaseClient<Database> {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc } as unknown as SupabaseClient<Database>;
}

describe('RateLimitRepository.consume', () => {
  it('RPC が true を返したら許可する', async () => {
    const supabase = createRpcStub({ data: true, error: null });
    const repo = new RateLimitRepository(supabase);
    expect(await repo.consume('random:ip:203.0.113.5', 30, 60)).toBe(true);
  });

  it('RPC が false を返したら拒否する', async () => {
    const supabase = createRpcStub({ data: false, error: null });
    const repo = new RateLimitRepository(supabase);
    expect(await repo.consume('random:ip:203.0.113.5', 30, 60)).toBe(false);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: { message: 'rpc failed' } });
    const repo = new RateLimitRepository(supabase);
    await expect(repo.consume('k', 1, 60)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('返り値が boolean でない場合は DatabaseError を throw する', async () => {
    const supabase = createRpcStub({ data: null, error: null });
    const repo = new RateLimitRepository(supabase);
    await expect(repo.consume('k', 1, 60)).rejects.toBeInstanceOf(DatabaseError);
  });
});
