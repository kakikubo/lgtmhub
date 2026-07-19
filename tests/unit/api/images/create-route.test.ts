import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';
import {
  AppError,
  BadRequestError,
  DailyLimitExceededError,
  DuplicateImageError,
  UnauthorizedError,
} from '@/src/lib/errors';
import {
  createImageErrorResponseSchema,
  createImageResponseSchema,
} from '@/src/lib/validation/image';

const createClient = vi.fn();
const buildImageService = vi.fn();
const revalidateTag = vi.fn();

vi.mock('next/cache', () => ({
  // 他の route テストと違い可変長で受ける。POST は revalidateTag(tag, 'max') と
  // 第 2 引数を渡しており、プロファイル指定まで検証したいため (app/api/CLAUDE.md)
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

const USER = { id: 'user-1' };
const VALID_URL = 'https://example.com/cat.png';

/** getUser() が指定ユーザー (または未認証なら null) を返す supabase クライアントを仕込む */
function mockAuthenticatedAs(user: { id: string } | null) {
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
  });
}

beforeEach(() => {
  createClient.mockReset();
  buildImageService.mockReset();
  revalidateTag.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callPost(body?: unknown, { rawBody }: { rawBody?: string } = {}) {
  const { POST } = await import('@/app/api/images/route');
  const request = new Request('http://localhost/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return POST(request as never);
}

describe('POST /api/images', () => {
  it('未認証なら 401 を返し Service を呼ばない', async () => {
    mockAuthenticatedAs(null);

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(401);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('body が JSON として壊れていれば 400 を返す', async () => {
    mockAuthenticatedAs(USER);

    const res = await callPost(undefined, { rawBody: '{ broken' });

    expect(res.status).toBe(400);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('imageUrl が HTTPS でなければ 400 とスキーマのメッセージを返す', async () => {
    mockAuthenticatedAs(USER);

    const res = await callPost({ imageUrl: 'http://example.com/cat.png' });

    expect(res.status).toBe(400);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('HTTPS の URL を入力してください');
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('成功時は 201 と createImageResponseSchema 準拠の JSON を返す', async () => {
    mockAuthenticatedAs(USER);
    const createImage = vi.fn().mockResolvedValue({ id: 'img-1', imageUrl: VALID_URL });
    buildImageService.mockReturnValue({ createImage });

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(201);
    const body = createImageResponseSchema.parse(await res.json());
    expect(body).toEqual({ id: 'img-1', imageUrl: VALID_URL });
    expect(createImage).toHaveBeenCalledWith('user-1', VALID_URL);
  });

  it('成功時はトップの一覧キャッシュを max プロファイルで revalidate する', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockResolvedValue({ id: 'img-1', imageUrl: VALID_URL }),
    });

    await callPost({ imageUrl: VALID_URL });

    expect(revalidateTag).toHaveBeenCalledWith(HOME_IMAGES_CACHE_TAG, 'max');
  });

  it('重複画像なら 409 と existingImageId を返す', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new DuplicateImageError('img-existing')),
    });

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(409);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.existingImageId).toBe('img-existing');
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('1日の登録上限を超えていれば 429 を返す', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new DailyLimitExceededError()),
    });

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(429);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('本日の登録上限(10枚)に達しました');
  });

  it('BadRequestError なら 400 とそのメッセージを返す', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new BadRequestError('画像が大きすぎます')),
    });

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(400);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('画像が大きすぎます');
  });

  it('UnauthorizedError なら 401 を返す', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new UnauthorizedError()),
    });

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(401);
  });

  it('その他の AppError なら 500 を返し内部メッセージを漏らさない', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new AppError('内部の詳細', 'SOMETHING_ELSE')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(500);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('サーバーエラーが発生しました');
    consoleErrorSpy.mockRestore();
  });

  it('想定外のエラーなら 500 を返し内部メッセージを漏らさない', async () => {
    mockAuthenticatedAs(USER);
    buildImageService.mockReturnValue({
      createImage: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callPost({ imageUrl: VALID_URL });

    expect(res.status).toBe(500);
    const body = createImageErrorResponseSchema.parse(await res.json());
    expect(body.error).toBe('サーバーエラーが発生しました');
    consoleErrorSpy.mockRestore();
  });
});
