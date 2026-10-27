import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, RateLimitExceededError } from '@/src/lib/errors';
import { randomImagesResponseSchema } from '@/src/lib/validation/image';

const createClient = vi.fn();
const buildImageService = vi.fn();
const consumeRandom = vi.fn();

// route は cacheComponents 下で dynamic 化するため `connection()` を呼ぶ。
// 単体テストには Next のリクエストスコープが無いので no-op に差し替える (NextResponse は実物を維持)。
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    connection: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

vi.mock('@/src/services/rate-limit-service', () => ({
  buildRateLimitService: () => ({ consumeRandom }),
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
  buildImageService.mockReset();
  consumeRandom.mockReset();
  consumeRandom.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet() {
  const { GET } = await import('@/app/api/images/random/route');
  const request = new Request('http://localhost/api/images/random', {
    headers: { 'x-real-ip': '203.0.113.5' },
  });
  return GET(request as never);
}

describe('GET /api/images/random', () => {
  it('成功時は randomImagesResponseSchema 準拠の JSON を返す', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listRandomImages: vi.fn().mockResolvedValue({ images: [IMAGE] }),
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    // クライアントが押下のたびに新しい 16 枚を取れるよう、route 単位でも no-store にしている
    expect(res.headers.get('Cache-Control')).toBe('no-store');

    const body = await res.json();
    const parsed = randomImagesResponseSchema.parse(body);
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]).toMatchObject({
      id: 'img-1',
      uploaderId: 'user-1',
    });
  });

  it('listRandomImages が想定外のエラーを投げたら 500 を返す', async () => {
    createClient.mockResolvedValue({});
    buildImageService.mockReturnValue({
      listRandomImages: vi.fn().mockRejectedValue(new DatabaseError('list boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });

  it('レートリミット超過なら 429 を返し、画像取得はしない', async () => {
    consumeRandom.mockRejectedValue(new RateLimitExceededError(60));

    const res = await callGet();

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(buildImageService).not.toHaveBeenCalled();
    const body = await res.json();
    expect(body.error).toContain('リクエストが多すぎます');
  });
});
