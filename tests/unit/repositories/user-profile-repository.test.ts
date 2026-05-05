import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import type { Database } from '@/src/types/database.types';

interface MaybeSingleResult {
  data: Database['public']['Tables']['user_profiles']['Row'] | null;
  error: { message: string } | null;
}

function createSupabaseStub(result: MaybeSingleResult): SupabaseClient<Database> {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient<Database>;
}

describe('UserProfileRepository', () => {
  describe('findById', () => {
    it('行が存在する場合は UserProfile を camelCase で返す', async () => {
      const supabase = createSupabaseStub({
        data: {
          id: 'user-1',
          github_login: 'octocat',
          display_name: 'The Octocat',
          avatar_url: 'https://avatars.example.com/octocat.png',
          is_admin: false,
          created_at: '2026-05-03T00:00:00.000Z',
          updated_at: '2026-05-03T00:00:00.000Z',
        },
        error: null,
      });

      const repo = new UserProfileRepository(supabase);
      const profile = await repo.findById('user-1');

      expect(profile).toEqual({
        id: 'user-1',
        githubLogin: 'octocat',
        displayName: 'The Octocat',
        avatarUrl: 'https://avatars.example.com/octocat.png',
        isAdmin: false,
        createdAt: new Date('2026-05-03T00:00:00.000Z'),
        updatedAt: new Date('2026-05-03T00:00:00.000Z'),
      });
    });

    it('行が存在しない場合は null を返す', async () => {
      const supabase = createSupabaseStub({ data: null, error: null });
      const repo = new UserProfileRepository(supabase);

      const profile = await repo.findById('missing');

      expect(profile).toBeNull();
    });

    it('Supabase が error を返した場合は DatabaseError を throw する', async () => {
      const supabase = createSupabaseStub({
        data: null,
        error: { message: 'connection failed' },
      });
      const repo = new UserProfileRepository(supabase);

      await expect(repo.findById('user-1')).rejects.toThrow(DatabaseError);
    });
  });

  describe('findByIdOrThrow', () => {
    it('行が存在しない場合は NotFoundError を throw する', async () => {
      const supabase = createSupabaseStub({ data: null, error: null });
      const repo = new UserProfileRepository(supabase);

      await expect(repo.findByIdOrThrow('missing')).rejects.toThrow(NotFoundError);
    });

    it('行が存在する場合は UserProfile を返す', async () => {
      const supabase = createSupabaseStub({
        data: {
          id: 'user-1',
          github_login: 'octocat',
          display_name: 'The Octocat',
          avatar_url: '',
          is_admin: true,
          created_at: '2026-05-03T00:00:00.000Z',
          updated_at: '2026-05-03T00:00:00.000Z',
        },
        error: null,
      });
      const repo = new UserProfileRepository(supabase);

      const profile = await repo.findByIdOrThrow('user-1');

      expect(profile.id).toBe('user-1');
      expect(profile.isAdmin).toBe(true);
    });
  });
});
