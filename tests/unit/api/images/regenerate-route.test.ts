import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestError,
  DatabaseError,
  DuplicateImageError,
  ForbiddenError,
  NotFoundError,
} from '@/src/lib/errors';

const createClient = vi.fn();
const buildImageService = vi.fn();
const requireAdmin = vi.fn();
const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTag(tag),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/lib/auth/require-admin', () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  createClient.mockReset();
  buildImageService.mockReset();
  requireAdmin.mockReset();
  revalidateTag.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callRegenerate(id: string, body?: unknown) {
  const { POST } = await import('@/app/api/images/[id]/regenerate/route');
  const request = new Request(`http://localhost/api/images/${id}/regenerate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return POST(request as never, { params: Promise.resolve({ id }) });
}

describe('POST /api/images/[id]/regenerate', () => {
  it('id が UUID 形式でなければ 400 を返し、認可判定より前で弾く', async () => {
    createClient.mockResolvedValue({});

    const res = await callRegenerate('not-a-uuid');

    expect(res.status).toBe(400);
    expect(requireAdmin).not.toHaveBeenCalled();
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('未ログイン (requireAdmin が UnauthorizedError) は 401 を返す', async () => {
    createClient.mockResolvedValue({});
    const { UnauthorizedError } = await import('@/src/lib/errors');
    requireAdmin.mockRejectedValue(new UnauthorizedError());

    const res = await callRegenerate(VALID_UUID);
    expect(res.status).toBe(401);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('非管理者 (requireAdmin が ForbiddenError) は 403 を返す', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockRejectedValue(new ForbiddenError());

    const res = await callRegenerate(VALID_UUID);
    expect(res.status).toBe(403);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('管理者判定 OK / body 省略で Service.regenerateImage を undefined で呼び、200 + revalidateTag', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    const regenerateImage = vi.fn().mockResolvedValue({
      image: {
        id: VALID_UUID,
        imageUrl: 'https://blob.example/lgtm/new.webp',
      },
      previousImageUrl: 'https://blob.example/lgtm/old.webp',
      urlChanged: false,
    });
    buildImageService.mockReturnValue({ regenerateImage });

    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const res = await callRegenerate(VALID_UUID, {});

    expect(res.status).toBe(200);
    expect(regenerateImage).toHaveBeenCalledWith(VALID_UUID, undefined, expect.any(Object));
    expect(revalidateTag).toHaveBeenCalledWith('lgtm-images:list');
    expect(consoleInfoSpy).toHaveBeenCalled();

    const json = await (res as Response).json();
    expect(json).toEqual({ id: VALID_UUID, imageUrl: 'https://blob.example/lgtm/new.webp' });

    consoleInfoSpy.mockRestore();
  });

  it('originalUrl 指定で Service に URL が渡り 200', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    const regenerateImage = vi.fn().mockResolvedValue({
      image: { id: VALID_UUID, imageUrl: 'https://blob.example/lgtm/new.webp' },
      previousImageUrl: 'https://blob.example/lgtm/old.webp',
      urlChanged: true,
    });
    buildImageService.mockReturnValue({ regenerateImage });
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const res = await callRegenerate(VALID_UUID, {
      originalUrl: 'https://example.com/new-source.jpg',
    });

    expect(res.status).toBe(200);
    expect(regenerateImage).toHaveBeenCalledWith(
      VALID_UUID,
      'https://example.com/new-source.jpg',
      expect.any(Object),
    );

    consoleInfoSpy.mockRestore();
  });

  it('originalUrl が http (非 HTTPS) なら 400 を返す', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });

    const res = await callRegenerate(VALID_UUID, {
      originalUrl: 'http://example.com/insecure.jpg',
    });

    expect(res.status).toBe(400);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('空ボディ (Content-Length 0) は URL 省略として扱い 200', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    const regenerateImage = vi.fn().mockResolvedValue({
      image: { id: VALID_UUID, imageUrl: 'https://blob.example/lgtm/new.webp' },
      previousImageUrl: 'https://blob.example/lgtm/old.webp',
      urlChanged: false,
    });
    buildImageService.mockReturnValue({ regenerateImage });
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const res = await callRegenerate(VALID_UUID);

    expect(res.status).toBe(200);
    expect(regenerateImage).toHaveBeenCalledWith(VALID_UUID, undefined, expect.any(Object));

    consoleInfoSpy.mockRestore();
  });

  it('VERCEL_ENV=preview のとき Service に skipOldBlobDeletion=true を渡す (Issue #195 副作用対策)', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    const regenerateImage = vi.fn().mockResolvedValue({
      image: { id: VALID_UUID, imageUrl: 'https://blob.example/lgtm/new.webp' },
      previousImageUrl: 'https://blob.example/lgtm/old.webp',
      urlChanged: false,
    });
    buildImageService.mockReturnValue({ regenerateImage });
    vi.stubEnv('VERCEL_ENV', 'preview');
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await callRegenerate(VALID_UUID, {});

    expect(regenerateImage).toHaveBeenCalledWith(VALID_UUID, undefined, {
      skipOldBlobDeletion: true,
    });

    vi.unstubAllEnvs();
    consoleInfoSpy.mockRestore();
  });

  it('VERCEL_ENV=production のとき Service に skipOldBlobDeletion=false を渡す', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    const regenerateImage = vi.fn().mockResolvedValue({
      image: { id: VALID_UUID, imageUrl: 'https://blob.example/lgtm/new.webp' },
      previousImageUrl: 'https://blob.example/lgtm/old.webp',
      urlChanged: false,
    });
    buildImageService.mockReturnValue({ regenerateImage });
    vi.stubEnv('VERCEL_ENV', 'production');
    const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    await callRegenerate(VALID_UUID, {});

    expect(regenerateImage).toHaveBeenCalledWith(VALID_UUID, undefined, {
      skipOldBlobDeletion: false,
    });

    vi.unstubAllEnvs();
    consoleInfoSpy.mockRestore();
  });

  it('Service が NotFoundError を投げたら 404', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    buildImageService.mockReturnValue({
      regenerateImage: vi.fn().mockRejectedValue(new NotFoundError('画像', VALID_UUID)),
    });

    const res = await callRegenerate(VALID_UUID, {});
    expect(res.status).toBe(404);
  });

  it('Service が DuplicateImageError を投げたら 409 + existingImageId', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    buildImageService.mockReturnValue({
      regenerateImage: vi.fn().mockRejectedValue(new DuplicateImageError('other-1')),
    });

    const res = await callRegenerate(VALID_UUID, {});
    expect(res.status).toBe(409);
    const json = await (res as Response).json();
    expect(json.existingImageId).toBe('other-1');
  });

  it('Service が BadRequestError を投げたら 400', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    buildImageService.mockReturnValue({
      regenerateImage: vi.fn().mockRejectedValue(new BadRequestError('取得失敗')),
    });

    const res = await callRegenerate(VALID_UUID, {});
    expect(res.status).toBe(400);
  });

  it('Service が想定外のエラーを投げたら 500', async () => {
    createClient.mockResolvedValue({});
    requireAdmin.mockResolvedValue({ userId: 'admin-1' });
    buildImageService.mockReturnValue({
      regenerateImage: vi.fn().mockRejectedValue(new DatabaseError('boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callRegenerate(VALID_UUID, {});

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
