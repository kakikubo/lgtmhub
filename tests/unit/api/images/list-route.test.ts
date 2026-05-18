import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { listImagesResponseSchema } from '@/src/lib/validation/image';

const createClient = vi.fn();
const buildImageService = vi.fn();
const buildUserProfileService = vi.fn();
const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  // 本テストでは getHomeImagesInitial を呼ばないが、
  // route が `@/src/lib/cache/list-home-images` 経由で unstable_cache を初期化するため、
  // パススルー実装を提供する
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

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
  revalidateTag.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet(query = '') {
  const { GET } = await import('@/app/api/images/route');
  // ハンドラは request.nextUrl.searchParams しか参照しないため最小モックで足りる
  return GET({ nextUrl: new URL(`http://localhost/api/images${query}`) } as never);
}

describe('GET /api/images', () => {
  it('cursor が ISO8601 でなければ 400 を返し Service を呼ばない', async () => {
    createClient.mockResolvedValue({});

    const res = await callGet('?cursor=not-a-date');

    expect(res.status).toBe(400);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('成功時は images の uploaderId で投稿者プロフィールを取得しレスポンスに同梱する', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });
    const findManyByIds = vi.fn().mockResolvedValue([PROFILE]);
    buildUserProfileService.mockReturnValue({ findManyByIds });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(findManyByIds).toHaveBeenCalledWith(['user-1']);

    const body = await res.json();
    // listImagesResponseSchema (クライアントが parse するスキーマ) と整合すること
    const parsed = listImagesResponseSchema.parse(body);
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
      listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });
    buildUserProfileService.mockReturnValue({
      findManyByIds: vi.fn().mockRejectedValue(new DatabaseError('profiles boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(listImagesResponseSchema.parse(body).profiles).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('listImages が想定外のエラーを投げたら 500 を返す', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockRejectedValue(new DatabaseError('list boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    expect(buildUserProfileService).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
