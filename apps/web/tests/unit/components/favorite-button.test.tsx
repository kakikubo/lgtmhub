import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/favorite-button';

const state = {
  favoritedIds: new Set<string>(),
  pendingIds: new Set<string>(),
  authResolved: true,
  signedIn: true,
  toast: null as string | null,
};
const toggle = vi.fn();

// ストアの非同期取得ロジックは favorite-store.test.tsx で検証済み。
// ここではボタン単体の描画・イベント発火のみを対象にするためストアをモックする。
vi.mock('@/components/favorite-store', () => ({
  useFavoriteState: () => state,
  toggleFavorite: (id: string) => toggle(id),
}));

function setup(options: { favorited?: boolean; pending?: boolean; authResolved?: boolean } = {}) {
  state.favoritedIds = new Set(options.favorited ? ['img-1', 'img-42'] : []);
  state.pendingIds = new Set(options.pending ? ['img-1', 'img-42'] : []);
  state.authResolved = options.authResolved ?? true;
  toggle.mockReset();
}

describe('FavoriteButton', () => {
  it('未登録なら state=off とラベル「お気に入りに追加」を出す', () => {
    setup({ favorited: false });
    render(<FavoriteButton lgtmImageId="img-1" />);

    const button = screen.getByTestId('favorite-button');
    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveAccessibleName('お気に入りに追加');
  });

  it('登録済みなら state=on とラベル「お気に入りから外す」を出す', () => {
    setup({ favorited: true });
    render(<FavoriteButton lgtmImageId="img-1" />);

    const button = screen.getByTestId('favorite-button');
    expect(button).toHaveAttribute('data-favorite-state', 'on');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAccessibleName('お気に入りから外す');
  });

  it('クリックで toggle に画像 ID を渡す', () => {
    setup();
    render(<FavoriteButton lgtmImageId="img-42" />);

    fireEvent.click(screen.getByTestId('favorite-button'));

    expect(toggle).toHaveBeenCalledWith('img-42');
  });

  it('通信中は disabled になる', () => {
    setup({ pending: true });
    render(<FavoriteButton lgtmImageId="img-1" />);

    expect(screen.getByTestId('favorite-button')).toBeDisabled();
  });

  it('ログイン状態が未確定のうちは disabled になる', () => {
    setup({ authResolved: false });
    render(<FavoriteButton lgtmImageId="img-1" />);

    expect(screen.getByTestId('favorite-button')).toBeDisabled();
  });

  it('icon variant は渡した className を保持する (カードのホバー表示用)', () => {
    setup({ favorited: false });
    render(<FavoriteButton lgtmImageId="img-1" variant="icon" className="opacity-0" />);

    expect(screen.getByTestId('favorite-button').className).toContain('opacity-0');
  });

  it('登録済みの icon variant はホバー用の opacity-0 を打ち消して常時表示にする', () => {
    setup({ favorited: true });
    render(<FavoriteButton lgtmImageId="img-1" variant="icon" className="opacity-0" />);

    const className = screen.getByTestId('favorite-button').className;
    expect(className).toContain('opacity-100');
    expect(className).not.toContain('opacity-0');
  });

  it('text variant はラベル文字列を本文にも表示する', () => {
    setup({ favorited: false });
    render(<FavoriteButton lgtmImageId="img-1" variant="text" />);

    expect(screen.getByTestId('favorite-button')).toHaveTextContent('お気に入りに追加');
  });
});
