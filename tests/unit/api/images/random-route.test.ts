import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { randomImagesResponseSchema } from '@/src/lib/validation/image';

const createClient = vi.fn();
const buildImageService = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
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
  createdAt: new Date('2026-05-18T00:00:00.000Z'),
};

beforeEach(() => {
  createClient.mockReset();
  buildImageService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet() {
  const { GET } = await import('@/app/api/images/random/route');
  return GET();
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
});
