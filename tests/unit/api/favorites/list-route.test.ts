import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { listFavoritesResponseSchema } from '@/src/lib/validation/favorite';

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

const IMAGE = {
  id: 'img-1',
  imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
  uploaderId: 'user-2',
  width: 266,
  height: 199,
  isAnimated: false,
  // お気に入り登録日時が createdAt に入る
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
};

beforeEach(() => {
  createClient.mockReset();
  buildFavoriteService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet(query = '') {
  const { GET } = await import('@/app/api/favorites/route');
  // ハンドラは request.nextUrl.searchParams しか参照しないため最小モックで足りる
  return GET({ nextUrl: new URL(`http://localhost/api/favorites${query}`) } as never);
}

describe('GET /api/favorites', () => {
  it('cursor が ISO8601 でなければ 400 を返し認証も Service 呼び出しも行わない', async () => {
    const res = await callGet('?cursor=not-a-date');

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(createClient).not.toHaveBeenCalled();
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('limit が上限超過なら 400 を返す', async () => {
    const res = await callGet('?limit=51');

    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('未ログインなら 401 を返し Service を呼ばない', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callGet();

    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(buildFavoriteService).not.toHaveBeenCalled();
  });

  it('成功時は listFavoritesResponseSchema 準拠の JSON を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      listFavorites: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
    });

    const res = await callGet();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    const parsed = listFavoritesResponseSchema.parse(await res.json());
    expect(parsed.images).toHaveLength(1);
    expect(parsed.images[0]).toMatchObject({ id: 'img-1', uploaderId: 'user-2' });
    expect(parsed.images[0]?.createdAt).toBe('2026-08-20T00:00:00.000Z');
    expect(parsed.nextCursor).toBeNull();
  });

  it('cursor / limit をセッションのユーザー ID と一緒に Service へ渡す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const listFavorites = vi.fn().mockResolvedValue({ images: [], nextCursor: null });
    buildFavoriteService.mockReturnValue({ listFavorites });

    await callGet('?cursor=2026-08-19T00:00:00.000Z&limit=5');

    expect(listFavorites).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: '2026-08-19T00:00:00.000Z',
      limit: 5,
    });
  });

  it('空文字クエリは未指定として扱う', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const listFavorites = vi.fn().mockResolvedValue({ images: [], nextCursor: null });
    buildFavoriteService.mockReturnValue({ listFavorites });

    const res = await callGet('?cursor=&limit=');

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect(listFavorites).toHaveBeenCalledWith({
      userId: 'user-1',
      cursor: undefined,
      limit: undefined,
    });
  });

  it('Service が想定外のエラーを投げたら 500 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildFavoriteService.mockReturnValue({
      listFavorites: vi.fn().mockRejectedValue(new DatabaseError('list boom')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet();

    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    consoleErrorSpy.mockRestore();
  });
});
