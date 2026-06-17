'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/src/lib/utils';

const FEEDBACK_DURATION_MS = 2000;

const LABEL_IDLE = 'マークダウンをコピー';
const LABEL_COPIED = 'コピーしました';

export function CopyMarkdownButton({
  imageUrl,
  className,
  variant = 'text',
}: {
  imageUrl: string;
  className?: string;
  variant?: 'text' | 'icon';
}) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const markdown = `![LGTM](${imageUrl})`;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS);
    } catch {
      // クリップボード API 失敗時はフィードバック表示せず、ユーザーが再試行できるよう状態を戻す
      setCopied(false);
    }
  };

  if (variant === 'icon') {
    const label = copied ? LABEL_COPIED : LABEL_IDLE;
    return (
      <button
        type="button"
        onClick={handleClick}
        data-testid="copy-markdown-button"
        data-copy-state={copied ? 'copied' : 'idle'}
        aria-label={label}
        title={label}
        className={cn(
          'rounded-full bg-gray-900/70 p-1.5 text-white hover:bg-gray-900/90',
          className,
        )}
      >
        {copied ? (
          <Check className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Copy className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="copy-markdown-button"
      data-copy-state={copied ? 'copied' : 'idle'}
      className={cn(
        'w-full text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700',
        className,
      )}
    >
      {copied ? <span data-testid="copy-feedback">コピーしました ✓</span> : LABEL_IDLE}
    </button>
  );
}
