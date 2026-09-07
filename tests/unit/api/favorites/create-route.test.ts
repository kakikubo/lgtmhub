import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, DuplicateFavoriteError, NotFoundError } from '@/src/lib/errors';
import { createFavoriteResponseSchema } from '@/src/lib/validation/favorite';

const createClient = vi.fn();
const buildFavoriteService = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/favorite-service', () => ({
  buildFavoriteService: () => buildFavoriteService(),
}));

interface AuthState {
  user: { id: string } | null;
}

function buildSupabase(auth: AuthState) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: auth.user } }),
    },
  };
}

// zod v4 の z.string().uuid() は UUID v1-v8 のみ受け付ける厳密版
const VALID_UUID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  createClient.mockReset();
  buildFavoriteService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callPost(body: unknown) {
  const { POST } = await import('@/app/api/favorites/route');
  const request = new Request('http://localhost/api/favorites', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
  return POST(request as never);
}

describe('POST /api/favorites', () => {
  it('未ログインなら 401 を返し Service を呼ばない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(401);
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('lgtmImageId が UUID でなければ 400 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));

    const res = await callPost({ lgtmImageId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('JSON でないボディは 400 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));

    const res = await callPost('{ broken');

    expect(res.status).toBe(400);
  });

  it('成功時は 201 と createFavoriteResponseSchema 準拠の JSON を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const addFavorite = vi.fn().mockResolvedValue({
      id: 'fav-1',
      userId: 'user-1',
      lgtmImageId: VALID_UUID,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    buildFavoriteService.mockReturnValue({ addFavorite });

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(201);
    const parsed = createFavoriteResponseSchema.parse(await res.json());
    expect(parsed).toEqual({ id: 'fav-1', lgtmImageId: VALID_UUID });
    // user_id はセッション由来の値を使う (ボディからは受け取らない)
    expect(addFavorite).toHaveBeenCalledWith('user-1', VALID_UUID);
  });

  it('成功レスポンスは共有キャッシュに載せない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      addFavorite: vi.fn().mockResolvedValue({
        id: 'fav-1',
        userId: 'user-1',
        lgtmImageId: VALID_UUID,
        createdAt: new Date(),
      }),
    });

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('すでに登録済みなら 409 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      addFavorite: vi.fn().mockRejectedValue(new DuplicateFavoriteError()),
    });

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(409);
  });

  it('画像が存在しなければ 404 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      addFavorite: vi.fn().mockRejectedValue(new NotFoundError('画像', VALID_UUID)),
    });

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(404);
  });

  it('AppError (DatabaseError) は 500 を返し内部メッセージを露出しない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      addFavorite: vi.fn().mockRejectedValue(new DatabaseError('insert boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('サーバーエラーが発生しました');
    consoleErrorSpy.mockRestore();
  });

  it('想定外のエラーも 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      addFavorite: vi.fn().mockRejectedValue(new Error('unexpected')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callPost({ lgtmImageId: VALID_UUID });

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
