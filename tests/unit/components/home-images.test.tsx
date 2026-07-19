import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeImages } from '@/components/home-images';
import { jsonResponse, makeApiImage, makeImage } from './_helpers';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const baseProps = {
  initialImages: [makeImage()],
  initialNextCursor: null,
  loadError: false,
  isLoggedIn: false,
};

async function clickRandom() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('random-button'));
  });
}

describe('HomeImages', () => {
  it('通常モードでは初期画像グリッドを描画する', () => {
    render(<HomeImages {...baseProps} />);

    expect(screen.getByTestId('home-images')).toHaveAttribute('data-mode', 'default');
    expect(screen.getByTestId('image-grid')).toBeInTheDocument();
  });

  it('loadError なら読み込みエラー状態を出す', () => {
    render(<HomeImages {...baseProps} initialImages={[]} loadError />);

    expect(screen.getByTestId('image-list-error')).toBeInTheDocument();
  });

  it('画像が空なら空状態を出す', () => {
    render(<HomeImages {...baseProps} initialImages={[]} />);

    expect(screen.getByTestId('image-list-empty')).toBeInTheDocument();
  });

  it('ランダム押下で random モードに切り替わる', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { images: [makeApiImage({ id: 'rand-1' })] }));
    render(<HomeImages {...baseProps} />);

    await clickRandom();

    expect(fetchMock).toHaveBeenCalledWith('/api/images/random', { cache: 'no-store' });
    expect(screen.getByTestId('home-images')).toHaveAttribute('data-mode', 'random');
  });

  it('ランダム取得が失敗したらエラーを表示し default モードのまま', async () => {
    fetchMock.mockResolvedValue(jsonResponse(503, {}));
    render(<HomeImages {...baseProps} />);

    await clickRandom();

    expect(screen.getByText(/読み込みに失敗しました/)).toBeInTheDocument();
    expect(screen.getByTestId('home-images')).toHaveAttribute('data-mode', 'default');
  });
});
