import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LoadMoreButton } from '@/components/load-more-button';
import { jsonResponse, makeApiImage } from './_helpers';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function clickLoadMore() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('load-more-button'));
  });
}

const INITIAL_CURSOR = JSON.stringify({
  createdAt: '2026-05-18T00:00:00.000Z',
  id: '00000000-0000-4000-8000-000000000001',
});
const NEXT_CURSOR = JSON.stringify({
  createdAt: '2026-05-17T00:00:00.000Z',
  id: '00000000-0000-4000-8000-000000000002',
});
const FAVORITES_CURSOR = JSON.stringify({
  createdAt: '2026-08-20T00:00:00.000Z',
  id: '00000000-0000-4000-8000-0000000000aa',
});

describe('LoadMoreButton', () => {
  it('クリックで cursor 付き API を叩き、取得分を追加表示する', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { images: [makeApiImage({ id: 'next-1' })], nextCursor: null }),
    );
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />);

    await clickLoadMore();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/images?cursor=${encodeURIComponent(INITIAL_CURSOR)}`,
      {
        cache: 'no-store',
      },
    );
    expect(screen.getByTestId('image-grid-extra')).toBeInTheDocument();
    // nextCursor が null になったのでボタンは消える
    expect(screen.queryByTestId('load-more-button')).not.toBeInTheDocument();
  });

  it('nextCursor が返れば追記しボタンを残す', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        images: [makeApiImage({ id: 'next-1' })],
        nextCursor: NEXT_CURSOR,
      }),
    );
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />);

    await clickLoadMore();

    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });

  // Issue #198: お気に入り一覧はレスポンス形状が同一なので endpoint 差し替えだけで再利用する
  it('endpoint を渡すとその API を叩く', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { images: [], nextCursor: null }));
    render(<LoadMoreButton initialCursor={FAVORITES_CURSOR} endpoint="/api/favorites" />);

    await clickLoadMore();

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/favorites?cursor=${encodeURIComponent(FAVORITES_CURSOR)}`,
      {
        cache: 'no-store',
      },
    );
  });

  it('API が失敗したらエラーメッセージを表示する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    render(<LoadMoreButton initialCursor={INITIAL_CURSOR} />);

    await clickLoadMore();

    expect(screen.getByText(/読み込みに失敗しました/)).toBeInTheDocument();
    // 失敗時 cursor は据え置きなのでボタンは残る
    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });
});
