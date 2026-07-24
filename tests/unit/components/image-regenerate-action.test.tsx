import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRegenerateAction } from '@/components/image-regenerate-action';
import { jsonResponse } from './_helpers';

const refresh = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

// image-detail-actions.test と同じ理由で Base UI ダイアログはパススルーにモックする
vi.mock('@/components/ui/alert-dialog', () => {
  const Box = ({ children, ...props }: { children?: ReactNode }) => (
    <div {...props}>{children}</div>
  );
  const Btn = ({ children, ...props }: { children?: ReactNode }) => (
    <button type="button" {...props}>
      {children}
    </button>
  );
  return {
    AlertDialog: Box,
    AlertDialogTrigger: Btn,
    AlertDialogContent: Box,
    AlertDialogHeader: Box,
    AlertDialogFooter: Box,
    AlertDialogTitle: Box,
    AlertDialogDescription: Box,
    AlertDialogCancel: Btn,
    AlertDialogAction: Btn,
  };
});

const CURRENT_URL = 'https://example.com/original.png';

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function confirmRegenerate() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('image-regenerate-confirm'));
  });
}

function setUrl(url: string) {
  fireEvent.change(screen.getByTestId('image-regenerate-url-input'), { target: { value: url } });
}

describe('ImageRegenerateAction', () => {
  it('URL 未変更なら originalUrl を送らず空ボディで再生成する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'img-1', imageUrl: 'https://x/y.webp' }));
    render(<ImageRegenerateAction imageId="img-1" currentOriginalUrl={CURRENT_URL} />);

    await confirmRegenerate();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/images/img-1/regenerate',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({}) }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it('URL を変更したら originalUrl を送る', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { id: 'img-1', imageUrl: 'https://x/y.webp' }));
    render(<ImageRegenerateAction imageId="img-1" currentOriginalUrl={CURRENT_URL} />);

    setUrl('https://example.com/new.png');
    await confirmRegenerate();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/images/img-1/regenerate',
      expect.objectContaining({
        body: JSON.stringify({ originalUrl: 'https://example.com/new.png' }),
      }),
    );
  });

  it('エラーレスポンスの error を表示し refresh しない', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { error: 'URL が不正です' }));
    render(<ImageRegenerateAction imageId="img-1" currentOriginalUrl={CURRENT_URL} />);

    await confirmRegenerate();

    expect(screen.getByTestId('image-regenerate-error')).toHaveTextContent('URL が不正です');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('200 だがレスポンス形状が不正でも警告ログを残して refresh へ degrade する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { unexpected: true }));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ImageRegenerateAction imageId="img-1" currentOriginalUrl={CURRENT_URL} />);

    await confirmRegenerate();

    expect(warnSpy).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('通信例外なら汎用エラーを表示する', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    render(<ImageRegenerateAction imageId="img-1" currentOriginalUrl={CURRENT_URL} />);

    await confirmRegenerate();

    expect(screen.getByTestId('image-regenerate-error')).toHaveTextContent(/通信エラー/);
    expect(refresh).not.toHaveBeenCalled();
  });
});
