import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { favoriteImageIdsResponseSchema } from '@/src/lib/validation/favorite';

const createClient = vi.fn();
const buildFavoriteService = vi.fn();

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

beforeEach(() => {
  createClient.mockReset();
  buildFavoriteService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet() {
  const { GET } = await import('@/app/api/favorites/ids/route');
  return GET();
}

describe('GET /api/favorites/ids', () => {
  it('未ログインなら 401 を返し Service を呼ばない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callGet();

    expect(res.status).toBe(401);
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('成功時は favoriteImageIdsResponseSchema 準拠の JSON を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const listFavoriteImageIds = vi.fn().mockResolvedValue(['img-1', 'img-2']);
    buildFavoriteService.mockReturnValue({ listFavoriteImageIds });

    const res = await callGet();

    expect(res.status).toBe(200);
    const parsed = favoriteImageIdsResponseSchema.parse(await res.json());
    expect(parsed.lgtmImageIds).toEqual(['img-1', 'img-2']);
    expect(listFavoriteImageIds).toHaveBeenCalledWith('user-1');
  });

  it('ユーザー固有データなので共有キャッシュに載せない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      listFavoriteImageIds: vi.fn().mockResolvedValue([]),
    });

    const res = await callGet();

    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('AppError (DatabaseError) は 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      listFavoriteImageIds: vi.fn().mockRejectedValue(new DatabaseError('ids boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });

  it('想定外のエラーも 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      listFavoriteImageIds: vi.fn().mockRejectedValue(new Error('unexpected')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
