import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageDetailActions } from '@/components/image-detail-actions';
import { jsonResponse } from './_helpers';

const refresh = vi.fn();
const push = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
}));

// vendored な Base UI ダイアログは portal / pointer 依存で happy-dom では扱いづらく、
// また計測対象外。ここではパススルーにモックし content を常時インライン描画することで、
// 本コンポーネントの handleDelete のロジック (fetch / router / エラー分岐) を検証する。
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

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function confirmDelete() {
  await act(async () => {
    fireEvent.click(screen.getByTestId('image-delete-confirm'));
  });
}

describe('ImageDetailActions', () => {
  it('204 なら DELETE 後に router.refresh → push する', async () => {
    fetchMock.mockResolvedValue({ status: 204, json: async () => null } as Response);
    render(<ImageDetailActions imageId="img-1" />);

    await confirmDelete();

    expect(fetchMock).toHaveBeenCalledWith('/api/images/img-1', { method: 'DELETE' });
    expect(refresh).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('エラーレスポンスの error メッセージを表示する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(403, { error: '権限がありません' }));
    render(<ImageDetailActions imageId="img-1" />);

    await confirmDelete();

    expect(screen.getByTestId('image-delete-error')).toHaveTextContent('権限がありません');
    expect(push).not.toHaveBeenCalled();
  });

  it('通信例外なら汎用エラーを表示する', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    render(<ImageDetailActions imageId="img-1" />);

    await confirmDelete();

    expect(screen.getByTestId('image-delete-error')).toHaveTextContent(/通信エラー/);
  });
});
