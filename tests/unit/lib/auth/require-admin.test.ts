import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { requireAdmin } from '@/src/lib/auth/require-admin';
import { ForbiddenError, UnauthorizedError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

interface ProfileRow {
  is_admin: boolean;
}

interface ProfileResult {
  data: ProfileRow | null;
  error: { message: string } | null;
}

function buildStub(options: {
  user: { id: string } | null;
  profile?: ProfileResult;
}): SupabaseClient<Database> {
  const getUser = vi.fn().mockResolvedValue({ data: { user: options.user }, error: null });
  const maybeSingle = vi.fn().mockResolvedValue(options.profile ?? { data: null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return {
    auth: { getUser },
    from,
  } as unknown as SupabaseClient<Database>;
}

describe('requireAdmin', () => {
  it('未ログインなら UnauthorizedError を throw する (user_profiles を引かない)', async () => {
    const supabase = buildStub({ user: null });

    await expect(requireAdmin(supabase)).rejects.toBeInstanceOf(UnauthorizedError);
    // from は呼ばれない (user_profiles を引かない)
    expect((supabase as unknown as { from: ReturnType<typeof vi.fn> }).from).not.toHaveBeenCalled();
  });

  it('is_admin=true なら AdminContext を返す', async () => {
    const supabase = buildStub({
      user: { id: 'user-1' },
      profile: { data: { is_admin: true }, error: null },
    });

    const ctx = await requireAdmin(supabase);
    expect(ctx.userId).toBe('user-1');
  });

  it('is_admin=false なら ForbiddenError を throw する', async () => {
    const supabase = buildStub({
      user: { id: 'user-2' },
      profile: { data: { is_admin: false }, error: null },
    });

    await expect(requireAdmin(supabase)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('user_profiles 行が無い場合 (data=null) は ForbiddenError を throw する', async () => {
    const supabase = buildStub({
      user: { id: 'user-3' },
      profile: { data: null, error: null },
    });

    await expect(requireAdmin(supabase)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('user_profiles の SELECT でエラーが返ったら ForbiddenError に倒す', async () => {
    const supabase = buildStub({
      user: { id: 'user-4' },
      profile: { data: null, error: { message: 'rls violation' } },
    });

    await expect(requireAdmin(supabase)).rejects.toBeInstanceOf(ForbiddenError);
  });
});
