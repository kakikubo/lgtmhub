import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorFallback } from '@/components/error-fallback';

describe('ErrorFallback', () => {
  it('日本語のエラー文言とトップへのリンクを出す', () => {
    render(<ErrorFallback retry={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('エラーが発生しました');
    expect(screen.getByRole('link', { name: 'トップページへ戻る' })).toHaveAttribute('href', '/');
  });

  it('再試行ボタンで retry を呼ぶ', () => {
    const retry = vi.fn();
    render(<ErrorFallback retry={retry} />);

    fireEvent.click(screen.getByRole('button', { name: '再試行' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });
});
