import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';

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

const VALID_UUID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  createClient.mockReset();
  buildFavoriteService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callDelete(lgtmImageId: string) {
  const { DELETE } = await import('@/app/api/favorites/[lgtmImageId]/route');
  const request = new Request(`http://localhost/api/favorites/${lgtmImageId}`, {
    method: 'DELETE',
  });
  return DELETE(request as never, { params: Promise.resolve({ lgtmImageId }) });
}

describe('DELETE /api/favorites/[lgtmImageId]', () => {
  it('lgtmImageId が UUID でなければ 400 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callDelete('not-a-uuid');

    expect(res.status).toBe(400);
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('未ログインなら 401 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(401);
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('成功時は 204 を返し、セッションのユーザー ID で解除する', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const removeFavorite = vi.fn().mockResolvedValue(undefined);
    buildFavoriteService.mockReturnValue({ removeFavorite });

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(204);
    expect(removeFavorite).toHaveBeenCalledWith('user-1', VALID_UUID);
  });

  it('未登録 (すでに解除済み) なら 404 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      removeFavorite: vi.fn().mockRejectedValue(new NotFoundError('お気に入り', VALID_UUID)),
    });

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(404);
  });

  it('AppError (DatabaseError) は 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      removeFavorite: vi.fn().mockRejectedValue(new DatabaseError('delete boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });

  it('想定外のエラーも 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      removeFavorite: vi.fn().mockRejectedValue(new Error('unexpected')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
