import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FavoriteImages } from '@/components/favorite-images';
import { makeImage } from './_helpers';

// ハートの挙動は favorite-store.test.tsx が担保するので、ここでは一覧の描画のみ検証する。
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

describe('FavoriteImages', () => {
  it('お気に入りが 0 件なら空状態を出す', () => {
    render(<FavoriteImages initialImages={[]} initialNextCursor={null} loadError={false} />);

    expect(screen.getByTestId('favorites-empty')).toHaveTextContent('まだお気に入りがありません');
    expect(screen.queryByTestId('favorites-grid')).not.toBeInTheDocument();
  });

  it('取得に失敗したらエラー状態を出す (空状態とは区別する)', () => {
    render(<FavoriteImages initialImages={[]} initialNextCursor={null} loadError={true} />);

    expect(screen.getByTestId('favorites-error')).toBeInTheDocument();
    expect(screen.queryByTestId('favorites-empty')).not.toBeInTheDocument();
  });

  it('お気に入りがあればグリッドで描画する', () => {
    render(
      <FavoriteImages
        initialImages={[makeImage({ id: 'a' }), makeImage({ id: 'b' })]}
        initialNextCursor={null}
        loadError={false}
      />,
    );

    expect(screen.getByTestId('favorites-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('image-card-link')).toHaveLength(2);
  });

  it('nextCursor が無ければ「もっと読み込む」を出さない', () => {
    render(
      <FavoriteImages initialImages={[makeImage()]} initialNextCursor={null} loadError={false} />,
    );

    expect(screen.queryByTestId('load-more-button')).not.toBeInTheDocument();
  });

  it('nextCursor があれば「もっと読み込む」を出す', () => {
    render(
      <FavoriteImages
        initialImages={[makeImage()]}
        initialNextCursor="2026-08-20T00:00:00.000Z"
        loadError={false}
      />,
    );

    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });
});
