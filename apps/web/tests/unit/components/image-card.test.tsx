import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ImageCard } from '@/components/image-card';
import { makeImage } from './_helpers';

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

describe('ImageCard', () => {
  it('詳細ページへのリンクと LGTM 画像を描画する', () => {
    render(<ImageCard image={makeImage({ id: 'abc' })} />);

    const link = screen.getByTestId('image-card-link');
    expect(link).toHaveAttribute('href', '/images/abc');

    const img = screen.getByAltText('LGTM');
    expect(img).toHaveAttribute('src', 'https://blob.example.com/lgtm/img-1.webp');
  });

  it('コピーボタン (icon variant) を重ねて描画する', () => {
    render(<ImageCard image={makeImage()} />);

    expect(screen.getByTestId('copy-markdown-button')).toHaveAttribute(
      'aria-label',
      'マークダウンをコピー',
    );
  });

  // Issue #198: 一覧カードにもお気に入りトグルを置く。未ログインでも表示する要件のため、
  // Provider の外 (= 未ログイン相当) でも描画されることを保証する
  it('お気に入りトグル (icon variant) をコピーボタンと並べて描画する', () => {
    render(<ImageCard image={makeImage({ id: 'abc' })} />);

    const favorite = screen.getByTestId('favorite-button');
    expect(favorite).toHaveAttribute('aria-label', 'お気に入りに追加');
    expect(favorite).toHaveAttribute('data-favorite-state', 'off');
    // コピーボタンと同じオーバーレイ内に並ぶ
    expect(favorite.parentElement).toBe(screen.getByTestId('copy-markdown-button').parentElement);
  });
});
