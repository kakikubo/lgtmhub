import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageRegisterForm } from '@/components/image-register-form';
import { jsonResponse } from './_helpers';

const refresh = vi.fn();
const push = vi.fn();
const fetchMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push }),
}));

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function type(url: string) {
  fireEvent.change(screen.getByTestId('image-register-input'), { target: { value: url } });
}

async function submit() {
  await act(async () => {
    fireEvent.submit(screen.getByTestId('image-register-form'));
  });
}

describe('ImageRegisterForm', () => {
  it('HTTPS でない URL はクライアント検証で弾き fetch しない', async () => {
    render(<ImageRegisterForm />);
    type('http://example.com/cat.png');

    await submit();

    expect(screen.getByTestId('image-register-error')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('成功時は入力欄をリセットし router.refresh → push する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { id: 'img-1', imageUrl: 'https://x/y.png' }));
    render(<ImageRegisterForm />);
    type('https://example.com/cat.png');

    await submit();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/images',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/');
    expect(screen.getByTestId('image-register-input')).toHaveValue('');
  });

  it('401 なら再ログインリンクを表示する', async () => {
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'ログインが必要です' }));
    render(<ImageRegisterForm />);
    type('https://example.com/cat.png');

    await submit();

    const error = screen.getByTestId('image-register-error');
    expect(error).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toHaveAttribute(
      'href',
      '/?auth_error=login_required',
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('通信例外時はフォールバックメッセージを出す', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    render(<ImageRegisterForm />);
    type('https://example.com/cat.png');

    await submit();

    expect(screen.getByTestId('image-register-error')).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
