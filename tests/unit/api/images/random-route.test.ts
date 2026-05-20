import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { randomImagesResponseSchema } from '@/src/lib/validation/image';

const createClient = vi.fn();
const buildImageService = vi.fn();
const buildUserProfileService = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

vi.mock('@/src/services/user-profile-service', () => ({
  buildUserProfileService: () => buildUserProfileService(),
}));

const IMAGE = {
  id: 'img-1',
  imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
  uploaderId: 'user-1',
  width: 266,
  height: 199,
  createdAt: new Date('2026-05-18T00:00:00.000Z'),
};

const PROFILE = {
  id: 'user-1',
  githubLogin: 'octocat',
  displayName: 'The Octocat',
  avatarUrl: 'https://avatars.example.com/octocat.png',
  isAdmin: false,
  createdAt: new Date('2026-05-03T00:00:00.000Z'),
  updatedAt: new Date('2026-05-03T00:00:00.000Z'),
};

beforeEach(() => {
  createClient.mockReset();
  buildImageService.mockReset();
  buildUserProfileService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet() {
  const { GET } = await import('@/app/api/images/random/route');
  return GET();
}

describe('GET /api/images/random', () => {
  it('成功時は images の uploaderId で投稿者プロフィールを取得しレスポンスに同梱する', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listRandomImages: vi.fn().mockResolvedValue({ images: [IMAGE] }),
    });
    const findManyByIds = vi.fn().mockResolvedValue([PROFILE]);
    buildUserProfileService.mockReturnValue({ findManyByIds });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(findManyByIds).toHaveBeenCalledWith(['user-1']);
    // クライアントが押下のたびに新しい 16 枚を取れるよう、route 単位でも no-store にしている
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = await res.json();
    // randomImagesResponseSchema (クライアントが parse するスキーマ) と整合すること
    const parsed = randomImagesResponseSchema.parse(body);
    expect(parsed.profiles).toHaveLength(1);
    expect(parsed.profiles[0]).toMatchObject({
      id: 'user-1',
      githubLogin: 'octocat',
      avatarUrl: 'https://avatars.example.com/octocat.png',
    });
  });

  it('プロフィール取得が失敗してもページを 500 にせず profiles=[] へ degrade する', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listRandomImages: vi.fn().mockResolvedValue({ images: [IMAGE] }),
    });
    buildUserProfileService.mockReturnValue({
      findManyByIds: vi.fn().mockRejectedValue(new DatabaseError('profiles boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(randomImagesResponseSchema.parse(body).profiles).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('listRandomImages が想定外のエラーを投げたら 500 を返す', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listRandomImages: vi.fn().mockRejectedValue(new DatabaseError('list boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    expect(buildUserProfileService).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
