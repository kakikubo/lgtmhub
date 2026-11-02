'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorFallback } from '@/components/error-fallback';
import './globals.css';

// ルートレイアウトが失敗したときに layout ごと置き換えて描画される (Issue #373)。
// そのため <html>/<body> とグローバル CSS を自前で持つ。metadata は export できないので <title> で指定する
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  // エラー境界で止まった例外は SDK のグローバルハンドラに届かないため明示的に送る (Issue #175)
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <title>エラーが発生しました | LGTMHub</title>
        <ErrorFallback retry={retry} />
      </body>
    </html>
  );
}
