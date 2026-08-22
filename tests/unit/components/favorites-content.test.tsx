import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoritesContent } from '@/components/favorites-content';
import { makeImage } from './_helpers';

const getUser = vi.fn();
const listFavorites = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock('@/src/services/favorite-service', () => ({
  buildFavoriteService: () => ({ listFavorites }),
}));

// server action は本テストでは呼ばないため、モジュール解決を通すためだけのスタブ
vi.mock('@/src/lib/auth/actions', () => ({
  signInWithGithub: vi.fn(),
}));

// ImageCard 経由でハートが描画されると、ストアが /api/favorites/ids を取得しにいく。
// 本テストの関心事ではないためストアをモックする (挙動は favorite-store.test.tsx が担保)。
vi.mock('@/components/favorite-store', () => ({
  useFavoriteState: () => ({
    favoritedIds: new Set<string>(),
    pendingIds: new Set<string>(),
    authResolved: true,
    signedIn: true,
    toast: null,
  }),
  toggleFavorite: vi.fn(),
}));

beforeEach(() => {
  getUser.mockReset();
  listFavorites.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
  // テスト内で張った console spy を assertion 失敗時にも必ず戻す
  vi.restoreAllMocks();
});

describe('FavoritesContent', () => {
  it('未ログインならログイン誘導を出し、Service を呼ばない', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    render(await FavoritesContent());

    expect(screen.getByTestId('favorites-signin-prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'GitHub でログイン' })).toBeInTheDocument();
    expect(listFavorites).not.toHaveBeenCalled();
  });

  it('ログイン済みならセッションのユーザー ID で一覧を取得して描画する', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    listFavorites.mockResolvedValue({ images: [makeImage()], nextCursor: null });

    render(await FavoritesContent());

    expect(listFavorites).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(screen.getByTestId('favorites-grid')).toBeInTheDocument();
    expect(screen.queryByTestId('favorites-signin-prompt')).not.toBeInTheDocument();
  });

  it('お気に入りが 0 件なら空状態を出す', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    listFavorites.mockResolvedValue({ images: [], nextCursor: null });

    render(await FavoritesContent());

    expect(screen.getByTestId('favorites-empty')).toBeInTheDocument();
  });

  it('取得失敗時は 500 に倒さずエラー状態へ degrade する', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    listFavorites.mockRejectedValue(new Error('db down'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await FavoritesContent());

    expect(screen.getByTestId('favorites-error')).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('nextCursor があれば「もっと読み込む」を描画する', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    listFavorites.mockResolvedValue({
      images: [makeImage()],
      nextCursor: '2026-08-20T00:00:00.000Z',
    });

    render(await FavoritesContent());

    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });
});
