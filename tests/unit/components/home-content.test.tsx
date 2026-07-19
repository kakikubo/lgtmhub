import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeContent } from '@/components/home-content';
import { makeImage } from './_helpers';

const getUser = vi.fn();
const getHomeImagesInitial = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock('@/src/lib/cache/list-home-images', () => ({
  getHomeImagesInitial: () => getHomeImagesInitial(),
  HOME_IMAGES_CACHE_TAG: 'lgtm-images:list',
}));

vi.mock('@/src/lib/auth/actions', () => ({
  signInWithGithub: vi.fn(),
}));

beforeEach(() => {
  getUser.mockReset();
  getHomeImagesInitial.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('HomeContent', () => {
  it('未ログインならログイン導線を出し、取得画像を HomeImages へ渡す', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    getHomeImagesInitial.mockResolvedValue({ images: [makeImage()], nextCursor: null });

    render(await HomeContent());

    expect(screen.getByRole('button', { name: 'ログインして登録' })).toBeInTheDocument();
    expect(screen.getByTestId('image-grid')).toBeInTheDocument();
    expect(screen.getByTestId('home-images')).toHaveAttribute('data-mode', 'default');
  });

  it('ログイン済みならログイン導線を出さない', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    getHomeImagesInitial.mockResolvedValue({ images: [makeImage()], nextCursor: null });

    render(await HomeContent());

    expect(screen.queryByRole('button', { name: 'ログインして登録' })).not.toBeInTheDocument();
  });

  it('一覧取得が失敗しても 500 にせず loadError で degrade する', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    getHomeImagesInitial.mockRejectedValue(new Error('supabase down'));
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(await HomeContent());

    expect(screen.getByTestId('image-list-error')).toBeInTheDocument();
    consoleErrorSpy.mockRestore();
  });
});
