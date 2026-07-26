import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';

// userEvent は setup() が独自の clipboard スタブを navigator に注入し、コンポーネントの
// navigator.clipboard.writeText 呼び出しを横取りしてしまう。ここでは書き込み内容そのものを
// 検証したいため、happy-dom が提供する navigator.clipboard を vi.spyOn し fireEvent で操作する。
let writeText: MockInstance<(text: string) => Promise<void>>;

beforeEach(() => {
  writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** onClick は async。fireEvent 後に await して writeText の解決と state 更新を反映させる */
async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el);
  });
}

describe('CopyMarkdownButton', () => {
  it('クリックで imageUrl をマークダウン形式でクリップボードへ書き込む', async () => {
    render(<CopyMarkdownButton imageUrl="https://example.com/cat.webp" />);

    await click(screen.getByTestId('copy-markdown-button'));

    expect(writeText).toHaveBeenCalledWith('![LGTM](https://example.com/cat.webp)');
  });

  it('コピー成功でフィードバックを表示し、2 秒後に元へ戻す', async () => {
    vi.useFakeTimers();
    render(<CopyMarkdownButton imageUrl="https://example.com/cat.webp" />);
    const button = screen.getByTestId('copy-markdown-button');

    await act(async () => {
      fireEvent.click(button);
    });

    expect(screen.getByTestId('copy-feedback')).toBeInTheDocument();
    expect(button).toHaveAttribute('data-copy-state', 'copied');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(screen.queryByTestId('copy-feedback')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('data-copy-state', 'idle');
  });

  it('icon variant では aria-label がトグルする', async () => {
    render(<CopyMarkdownButton imageUrl="https://example.com/cat.webp" variant="icon" />);
    const button = screen.getByTestId('copy-markdown-button');

    expect(button).toHaveAttribute('aria-label', 'マークダウンをコピー');

    await click(button);

    expect(button).toHaveAttribute('aria-label', 'コピーしました');
  });

  it('クリップボード失敗時はフィードバックを表示しない', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<CopyMarkdownButton imageUrl="https://example.com/cat.webp" />);
    const button = screen.getByTestId('copy-markdown-button');

    await click(button);

    expect(screen.queryByTestId('copy-feedback')).not.toBeInTheDocument();
    expect(button).toHaveAttribute('data-copy-state', 'idle');
  });
});
