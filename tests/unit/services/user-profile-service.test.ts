import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import { buildUserProfileService, UserProfileService } from '@/src/services/user-profile-service';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

interface Mocks {
  userProfileRepo: {
    findById: ReturnType<typeof vi.fn>;
    findManyByIds: ReturnType<typeof vi.fn>;
  };
}

function buildMocks(): Mocks {
  return {
    userProfileRepo: {
      findById: vi.fn(),
      findManyByIds: vi.fn(),
    },
  };
}

function buildService(mocks: Mocks): UserProfileService {
  return new UserProfileService({
    userProfileRepo: mocks.userProfileRepo as unknown as UserProfileRepository,
  });
}

function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    githubLogin: 'octocat',
    displayName: 'The Octocat',
    avatarUrl: 'https://avatars.example.com/octocat.png',
    isAdmin: false,
    createdAt: new Date('2026-05-03T00:00:00.000Z'),
    updatedAt: new Date('2026-05-03T00:00:00.000Z'),
    ...overrides,
  };
}

describe('UserProfileService.findById', () => {
  it('Repository.findById に委譲して結果をそのまま返す', async () => {
    const mocks = buildMocks();
    const profile = buildProfile({ id: 'user-1' });
    mocks.userProfileRepo.findById.mockResolvedValue(profile);

    const service = buildService(mocks);
    const result = await service.findById('user-1');

    expect(mocks.userProfileRepo.findById).toHaveBeenCalledWith('user-1');
    expect(result).toBe(profile);
  });

  it('Repository が null を返したら null を返す', async () => {
    const mocks = buildMocks();
    mocks.userProfileRepo.findById.mockResolvedValue(null);

    const service = buildService(mocks);
    expect(await service.findById('missing')).toBeNull();
  });
});

describe('UserProfileService.findManyByIds', () => {
  it('空配列を渡されたら Repository を呼ばずに [] を返す', async () => {
    const mocks = buildMocks();
    const service = buildService(mocks);

    const result = await service.findManyByIds([]);

    expect(result).toEqual([]);
    expect(mocks.userProfileRepo.findManyByIds).not.toHaveBeenCalled();
  });

  it('Repository に dedupe 済みの ids を渡し、戻り値をそのまま返す', async () => {
    const mocks = buildMocks();
    const profiles = [buildProfile({ id: 'user-1' }), buildProfile({ id: 'user-2' })];
    mocks.userProfileRepo.findManyByIds.mockResolvedValue(profiles);

    const service = buildService(mocks);
    const result = await service.findManyByIds(['user-1', 'user-2', 'user-1']);

    expect(mocks.userProfileRepo.findManyByIds).toHaveBeenCalledTimes(1);
    const passed = mocks.userProfileRepo.findManyByIds.mock.calls[0]?.[0] as string[];
    expect([...passed].sort()).toEqual(['user-1', 'user-2']);
    expect(result).toBe(profiles);
  });

  it('Repository が throw したらそのまま伝播する', async () => {
    const mocks = buildMocks();
    mocks.userProfileRepo.findManyByIds.mockRejectedValue(new Error('boom'));

    const service = buildService(mocks);
    await expect(service.findManyByIds(['user-1'])).rejects.toThrow('boom');
  });
});

describe('buildUserProfileService', () => {
  it('Supabase Client から UserProfileService インスタンスを構築できる', () => {
    const supabase = { from: () => ({}) } as unknown as SupabaseClient<Database>;
    const service = buildUserProfileService(supabase);
    expect(service).toBeInstanceOf(UserProfileService);
  });
});
