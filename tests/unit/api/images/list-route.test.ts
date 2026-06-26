import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { listImagesResponseSchema } from '@/src/lib/validation/image';

const createClient = vi.fn();
const createAnonClient = vi.fn();
const buildImageService = vi.fn();
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

vi.mock('@/src/lib/supabase/anon', () => ({
  createAnonClient: () => createAnonClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

const IMAGE = {
  id: 'img-1',
  imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
  uploaderId: 'user-1',
  width: 266,
  height: 199,
  isAnimated: false,
  createdAt: new Date('2026-05-18T00:00:00.000Z'),
};

beforeEach(() => {
  createClient.mockReset();
  createAnonClient.mockReset();
  buildImageService.mockReset();
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
    createAnonClient.mockReturnValue({});

    const res = await callGet('?cursor=not-a-date');

    expect(res.status).toBe(400);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('成功時は listImagesResponseSchema 準拠の JSON を返す', async () => {
    createAnonClient.mockReturnValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = listImagesResponseSchema.parse(body);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]).toMatchObject({
      id: 'img-1',
      imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
      uploaderId: 'user-1',
    });
    expect(parsed.nextCursor).toBeNull();
  });

  it('成功時は Vercel CDN 用 Cache-Control ヘッダを返す (Issue #46 案 #3)', async () => {
    createAnonClient.mockReturnValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });

    const res = await callGet();

    expect(res.headers.get('Cache-Control')).toBe('s-maxage=60, stale-while-revalidate=300');
  });

  it('Cookie 連携の createClient は呼ばず anon クライアントだけを使う (CDN キャッシュ条件)', async () => {
    createAnonClient.mockReturnValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });

    await callGet();

    expect(createAnonClient).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });

  it('listImages が想定外のエラーを投げたら 500 を返す', async () => {
    createAnonClient.mockReturnValue({});
    buildImageService.mockReturnValue({
      listImages: vi.fn().mockRejectedValue(new DatabaseError('list boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
