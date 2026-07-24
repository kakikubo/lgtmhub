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

describe('LoadMoreButton', () => {
  it('クリックで cursor 付き API を叩き、取得分を追加表示する', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { images: [makeApiImage({ id: 'next-1' })], nextCursor: null }),
    );
    render(<LoadMoreButton initialCursor="2026-05-18T00:00:00.000Z" />);

    await clickLoadMore();

    expect(fetchMock).toHaveBeenCalledWith('/api/images?cursor=2026-05-18T00%3A00%3A00.000Z', {
      cache: 'no-store',
    });
    expect(screen.getByTestId('image-grid-extra')).toBeInTheDocument();
    // nextCursor が null になったのでボタンは消える
    expect(screen.queryByTestId('load-more-button')).not.toBeInTheDocument();
  });

  it('nextCursor が返れば追記しボタンを残す', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        images: [makeApiImage({ id: 'next-1' })],
        nextCursor: '2026-05-17T00:00:00.000Z',
      }),
    );
    render(<LoadMoreButton initialCursor="2026-05-18T00:00:00.000Z" />);

    await clickLoadMore();

    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });

  it('API が失敗したらエラーメッセージを表示する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, {}));
    render(<LoadMoreButton initialCursor="2026-05-18T00:00:00.000Z" />);

    await clickLoadMore();

    expect(screen.getByText(/読み込みに失敗しました/)).toBeInTheDocument();
    // 失敗時 cursor は据え置きなのでボタンは残る
    expect(screen.getByTestId('load-more-button')).toBeInTheDocument();
  });
});
