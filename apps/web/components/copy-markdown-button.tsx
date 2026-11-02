'use client';

import { Check, Copy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '@/src/lib/utils';

const FEEDBACK_DURATION_MS = 2000;

const LABEL_IDLE = 'マークダウンをコピー';
const LABEL_COPIED = 'コピーしました';
const LABEL_FAILED = 'コピーできませんでした';

type CopyStatus = 'idle' | 'copied' | 'failed';

/** live region へ書く文言。idle は空にしておき、成否が変わったときだけ読み上げさせる */
const ANNOUNCEMENTS: Record<CopyStatus, string> = {
  idle: '',
  copied: LABEL_COPIED,
  failed: LABEL_FAILED,
};

export function CopyMarkdownButton({
  imageUrl,
  className,
  variant = 'text',
}: {
  imageUrl: string;
  className?: string;
  variant?: 'text' | 'icon';
}) {
  // 毎回新しいオブジェクトを入れる。同じ status の再設定でも effect を再実行させ、
  // 連打時に表示時間をクリックごとに数え直すため
  const [result, setResult] = useState<{ status: CopyStatus }>({ status: 'idle' });
  const { status } = result;

  // 結果表示を一定時間で戻す。cleanup で解除するので、連打時はタイマーが張り直され、
  // アンマウント後に setState が走ることもない
  useEffect(() => {
    if (result.status === 'idle') return;
    const timerId = window.setTimeout(() => setResult({ status: 'idle' }), FEEDBACK_DURATION_MS);
    return () => window.clearTimeout(timerId);
  }, [result]);

  const handleClick = async () => {
    const markdown = `![LGTM](${imageUrl})`;
    try {
      await navigator.clipboard.writeText(markdown);
      setResult({ status: 'copied' });
    } catch {
      // 非 HTTPS・権限拒否など。黙って失敗するとコピーできたと誤解されるため明示する
      setResult({ status: 'failed' });
    }
  };

  // icon 版は aria-label が名前を上書きし、名前の変更は多くのスクリーンリーダーが読み上げない。
  // 成否はボタンの外に常時置いた live region で通知する (Issue #377)。
  // sr-only は絶対配置なので、親の flex レイアウト (カードのオーバーレイ) に影響しない
  const announcement = (
    <span role="status" className="sr-only" data-testid="copy-announcement">
      {ANNOUNCEMENTS[status]}
    </span>
  );

  if (variant === 'icon') {
    const label = status === 'idle' ? LABEL_IDLE : ANNOUNCEMENTS[status];
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          data-testid="copy-markdown-button"
          data-copy-state={status}
          aria-label={label}
          title={label}
          className={cn(
            'rounded-full bg-gray-900/70 p-1.5 text-white hover:bg-gray-900/90',
            className,
          )}
        >
          {status === 'copied' ? (
            <Check className="h-5 w-5" aria-hidden="true" />
          ) : status === 'failed' ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Copy className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        {announcement}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        data-testid="copy-markdown-button"
        data-copy-state={status}
        className={cn(
          'w-full text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700',
          className,
        )}
      >
        {status === 'copied' ? (
          <span data-testid="copy-feedback">コピーしました ✓</span>
        ) : status === 'failed' ? (
          <span data-testid="copy-feedback">{LABEL_FAILED}</span>
        ) : (
          LABEL_IDLE
        )}
      </button>
      {announcement}
    </>
  );
}
