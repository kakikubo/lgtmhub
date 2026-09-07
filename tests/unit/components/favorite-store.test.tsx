import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FavoriteButton } from '@/components/favorite-button';
import { resetFavoriteStoreForTest } from '@/components/favorite-store';
import { FavoriteToaster } from '@/components/favorite-toaster';
import { jsonResponse } from './_helpers';

const signInWithGithub = vi.fn();

vi.mock('@/src/lib/auth/actions', () => ({
  signInWithGithub: () => signInWithGithub(),
}));

const IMAGE_ID = 'img-1';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  // ストアはモジュールスコープなのでテストごとに明示的に初期化する
  resetFavoriteStoreForTest();
  signInWithGithub.mockReset().mockResolvedValue(undefined);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** ハートとトーストを描画する。ストアは最初の購読で ID 取得を開始する */
function renderFavoriteUi(imageIds: string[] = [IMAGE_ID]) {
  render(
    <>
      {imageIds.map((id) => (
        <FavoriteButton key={id} lgtmImageId={id} />
      ))}
      <FavoriteToaster />
    </>,
  );
}

/**
 * `body.cancel()` の呼び出しを検証できる Response モック。
 * お気に入り API は全レスポンスが no-store なので、使わないボディは破棄する必要がある。
 */
function cancellableResponse(status: number, body: unknown) {
  const cancel = vi.fn().mockResolvedValue(undefined);
  const res = { ...jsonResponse(status, body), body: { cancel } } as unknown as Response;
  return { res, cancel };
}

/** ids 取得のレスポンスを設定して描画し、初期取得の完了まで待つ */
async function setupResolved(idsResponse: Response, imageIds: string[] = [IMAGE_ID]) {
  fetchMock.mockResolvedValueOnce(idsResponse);
  renderFavoriteUi(imageIds);
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith('/api/favorites/ids', expect.anything());
  });
  // 初期取得後の state 反映を確定させる
  await act(async () => {});
  return screen.getAllByTestId('favorite-button')[0] as HTMLElement;
}

describe('お気に入りストアの初期取得', () => {
  it('ids で返った画像は塗りつぶしハート (state=on) で描画する', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [IMAGE_ID] }));

    expect(button).toHaveAttribute('data-favorite-state', 'on');
    expect(button).toHaveAttribute('aria-label', 'お気に入りから外す');
  });

  it('ids に無い画像は輪郭ハート (state=off)', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: ['other'] }));

    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(button).toHaveAttribute('aria-label', 'お気に入りに追加');
  });

  it('401 (未ログイン) でもボタンは表示し、輪郭ハートのままにする', async () => {
    const button = await setupResolved(jsonResponse(401, { error: '認証が必要です' }));

    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('data-favorite-state', 'off');
  });

  it('401 のときレスポンスボディを破棄してリクエストを完了させる', async () => {
    // 未読のまま放置すると no-store のレスポンスでストリームが開いたままになり、
    // ブラウザがリクエストを完了扱いにしない (e2e の networkidle に到達しない)
    const { res, cancel } = cancellableResponse(401, { error: '認証が必要です' });

    await setupResolved(res);

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('ids の取得はハートが何個あっても 1 回だけ', async () => {
    await setupResolved(jsonResponse(200, { lgtmImageIds: [] }), ['a', 'b', 'c']);

    const idsCalls = fetchMock.mock.calls.filter((call) => call[0] === '/api/favorites/ids');
    expect(idsCalls).toHaveLength(1);
  });
});

describe('ログイン状態が確定するまでの挙動', () => {
  it('確定するまでボタンは disabled で、押しても OAuth へ飛ばさない', async () => {
    let resolveIds: ((res: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolveIds = resolve;
      }),
    );
    renderFavoriteUi();

    const button = screen.getByTestId('favorite-button');
    expect(button).toBeDisabled();

    // 確定前のクリックを「未ログイン」と誤判定してログイン済みユーザーを
    // OAuth へ飛ばさないこと (disabled を無視した click でも no-op であること)
    await act(async () => {
      fireEvent.click(button);
    });
    expect(signInWithGithub).not.toHaveBeenCalled();

    await act(async () => {
      resolveIds?.(jsonResponse(200, { lgtmImageIds: [] }));
    });
    expect(button).not.toBeDisabled();
  });

  it('ids 取得が失敗してもボタンは永久に disabled にならない', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    renderFavoriteUi();

    await waitFor(() => {
      expect(screen.getByTestId('favorite-button')).not.toBeDisabled();
    });
    expect(screen.getByTestId('favorite-button')).toHaveAttribute('data-favorite-state', 'off');
  });
});

describe('お気に入りのトグル', () => {
  it('未登録の画像を押すと即座に塗りつぶし、POST /api/favorites を送る', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'fav-1', lgtmImageId: IMAGE_ID }));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'on');
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/favorites',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ lgtmImageId: IMAGE_ID }) }),
    );
  });

  it('登録済みの画像を押すと即座に輪郭へ戻し、DELETE を送る', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [IMAGE_ID] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(204, null));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/favorites/${IMAGE_ID}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('登録 / 解除でもレスポンスボディを破棄する', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    const { res, cancel } = cancellableResponse(201, { id: 'fav-1', lgtmImageId: IMAGE_ID });
    fetchMock.mockResolvedValueOnce(res);

    await act(async () => {
      fireEvent.click(button);
    });

    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('登録が 500 で失敗したら輪郭へロールバックしトーストを表示する', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'サーバーエラーが発生しました' }));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(screen.getByTestId('favorite-toast')).toHaveTextContent(
      'お気に入りの更新に失敗しました',
    );
  });

  it('解除が 500 で失敗したら塗りつぶしへロールバックする', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [IMAGE_ID] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'on');
    expect(screen.getByTestId('favorite-toast')).toBeInTheDocument();
  });

  it('通信エラーでもロールバックしトーストを表示する', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(screen.getByTestId('favorite-toast')).toBeInTheDocument();
  });

  it('409 (すでに登録済み) は成功として扱い、塗りつぶしのままにする', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: 'すでにお気に入りに登録されています' }),
    );

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'on');
    expect(screen.queryByTestId('favorite-toast')).not.toBeInTheDocument();
  });

  it('404 (すでに解除済み) は冪等な成功として扱い、輪郭のままにする', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [IMAGE_ID] }));
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'お気に入りが見つかりません' }));

    await act(async () => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('data-favorite-state', 'off');
    expect(screen.queryByTestId('favorite-toast')).not.toBeInTheDocument();
  });

  it('未ログインで押すと API を叩かず GitHub ログインへ誘導する', async () => {
    const button = await setupResolved(jsonResponse(401, { error: '認証が必要です' }));
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      fireEvent.click(button);
    });

    expect(signInWithGithub).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls).toHaveLength(callsBefore);
    expect(button).toHaveAttribute('data-favorite-state', 'off');
  });

  it('通信中は二重送信を抑止する', async () => {
    const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
    let resolvePost: ((res: Response) => void) | undefined;
    fetchMock.mockReturnValueOnce(
      new Promise<Response>((resolve) => {
        resolvePost = resolve;
      }),
    );

    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toBeDisabled();

    const callsDuringPending = fetchMock.mock.calls.length;
    await act(async () => {
      fireEvent.click(button);
    });
    expect(fetchMock.mock.calls).toHaveLength(callsDuringPending);

    await act(async () => {
      resolvePost?.(jsonResponse(201, { id: 'fav-1', lgtmImageId: IMAGE_ID }));
    });
    expect(button).not.toBeDisabled();
  });

  it('複数の画像を同時にトグルしても互いの状態を壊さない', async () => {
    await setupResolved(jsonResponse(200, { lgtmImageIds: [] }), ['a', 'b']);
    const [buttonA, buttonB] = screen.getAllByTestId('favorite-button');

    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: 'fav-a', lgtmImageId: 'a' }));
    await act(async () => {
      fireEvent.click(buttonA as HTMLElement);
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
    await act(async () => {
      fireEvent.click(buttonB as HTMLElement);
    });

    // 成功した a は塗りつぶしのまま、失敗した b だけロールバックされる
    expect(buttonA).toHaveAttribute('data-favorite-state', 'on');
    expect(buttonB).toHaveAttribute('data-favorite-state', 'off');
  });
});

describe('トースト', () => {
  it('一定時間後に消える', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const button = await setupResolved(jsonResponse(200, { lgtmImageIds: [] }));
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));

      await act(async () => {
        fireEvent.click(button);
      });
      expect(screen.getByTestId('favorite-toast')).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000);
      });
      expect(screen.queryByTestId('favorite-toast')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  // 2 本のタイマーが並走すると、先に発火した 1 本目が 2 本目のメッセージを
  // 規定時間より早く消してしまう。タイマーは常に 1 本だけ張り直す
  it('連続で失敗しても、後から出たトーストが規定時間より早く消えない', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await setupResolved(jsonResponse(200, { lgtmImageIds: [] }), ['a', 'b']);
      const [buttonA, buttonB] = screen.getAllByTestId('favorite-button');

      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
      await act(async () => {
        fireEvent.click(buttonA as HTMLElement);
      });
      expect(screen.getByTestId('favorite-toast')).toBeInTheDocument();

      // 3 秒後 (1 本目のタイマー満了前) に 2 件目が失敗する
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3000);
      });
      fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: 'boom' }));
      await act(async () => {
        fireEvent.click(buttonB as HTMLElement);
      });

      // 1 本目のタイマー満了タイミング (合計 4 秒) を過ぎても消えていないこと
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1500);
      });
      expect(screen.getByTestId('favorite-toast')).toBeInTheDocument();

      // 2 本目の表示から 4 秒経てば消える
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2600);
      });
      expect(screen.queryByTestId('favorite-toast')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
