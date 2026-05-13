import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import type { Database } from '@/src/types/database.types';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

interface MaybeSingleResult {
  data: UserProfileRow | null;
  error: { message: string } | null;
}

interface ManyResult {
  data: UserProfileRow[] | null;
  error: { message: string } | null;
}

function createSupabaseStub(result: MaybeSingleResult): SupabaseClient<Database> {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });

  return { from } as unknown as SupabaseClient<Database>;
}

function createInStub(result: ManyResult) {
  const inFn = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ in: inFn });
  const from = vi.fn().mockReturnValue({ select });
  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    select,
    inFn,
  };
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

  describe('findManyByIds', () => {
    it('空配列を渡されたら Supabase を呼ばずに [] を返す', async () => {
      const stub = createInStub({ data: [], error: null });
      const repo = new UserProfileRepository(stub.supabase);

      const result = await repo.findManyByIds([]);

      expect(result).toEqual([]);
      expect(stub.from).not.toHaveBeenCalled();
      expect(stub.inFn).not.toHaveBeenCalled();
    });

    it('複数行が返ったら UserProfile 配列を camelCase で返す', async () => {
      const stub = createInStub({
        data: [
          {
            id: 'user-1',
            github_login: 'octocat',
            display_name: 'The Octocat',
            avatar_url: 'https://avatars.example.com/octocat.png',
            is_admin: false,
            created_at: '2026-05-03T00:00:00.000Z',
            updated_at: '2026-05-03T00:00:00.000Z',
          },
          {
            id: 'user-2',
            github_login: 'monalisa',
            display_name: 'Monalisa',
            avatar_url: 'https://avatars.example.com/monalisa.png',
            is_admin: true,
            created_at: '2026-05-04T00:00:00.000Z',
            updated_at: '2026-05-04T00:00:00.000Z',
          },
        ],
        error: null,
      });
      const repo = new UserProfileRepository(stub.supabase);

      const profiles = await repo.findManyByIds(['user-1', 'user-2']);

      expect(stub.from).toHaveBeenCalledWith('user_profiles');
      expect(stub.inFn).toHaveBeenCalledWith('id', ['user-1', 'user-2']);
      expect(profiles).toHaveLength(2);
      expect(profiles[0]).toMatchObject({
        id: 'user-1',
        githubLogin: 'octocat',
        displayName: 'The Octocat',
        isAdmin: false,
      });
      expect(profiles[1]).toMatchObject({
        id: 'user-2',
        githubLogin: 'monalisa',
        isAdmin: true,
      });
    });

    it('Supabase が error を返したら DatabaseError を throw する', async () => {
      const stub = createInStub({ data: null, error: { message: 'connection failed' } });
      const repo = new UserProfileRepository(stub.supabase);

      await expect(repo.findManyByIds(['user-1'])).rejects.toThrow(DatabaseError);
    });

    it('一部の id だけ一致した場合は一致した分だけ返す (順序保証なし)', async () => {
      const stub = createInStub({
        data: [
          {
            id: 'user-1',
            github_login: 'octocat',
            display_name: 'The Octocat',
            avatar_url: '',
            is_admin: false,
            created_at: '2026-05-03T00:00:00.000Z',
            updated_at: '2026-05-03T00:00:00.000Z',
          },
        ],
        error: null,
      });
      const repo = new UserProfileRepository(stub.supabase);

      const profiles = await repo.findManyByIds(['user-1', 'missing']);

      expect(profiles).toHaveLength(1);
      expect(profiles[0]?.id).toBe('user-1');
    });
  });
});
