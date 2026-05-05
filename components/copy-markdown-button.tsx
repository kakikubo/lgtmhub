'use client';

import { useState } from 'react';

const FEEDBACK_DURATION_MS = 2000;

export function CopyMarkdownButton({ imageUrl }: { imageUrl: string }) {
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

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="copy-markdown-button"
      data-copy-state={copied ? 'copied' : 'idle'}
      className="w-full text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
    >
      {copied ? <span data-testid="copy-feedback">コピーしました ✓</span> : 'マークダウンをコピー'}
    </button>
  );
}
