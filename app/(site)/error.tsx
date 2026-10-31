'use client';

import { ErrorFallback } from '@/components/error-fallback';

// (site)/layout.tsx 配下のページで投げられた例外を受ける。同階層の layout (Header) は
// 包まないため、Header 側は取得失敗を自前で degrade させている (Issue #373)
export default function SiteError({ retry }: { error: unknown; retry: () => void }) {
  return <ErrorFallback retry={retry} />;
}
