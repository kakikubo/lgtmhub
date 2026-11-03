'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { ErrorFallback } from '@/components/error-fallback';

// (site)/layout.tsx 配下のページで投げられた例外を受ける。同階層の layout (Header) は
// 包まないため、Header 側は取得失敗を自前で degrade させている (Issue #373)
export default function SiteError({ error, retry }: { error: unknown; retry: () => void }) {
  // エラー境界で止まった例外は SDK のグローバルハンドラに届かないため明示的に送る (Issue #175)
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return <ErrorFallback retry={retry} />;
}
