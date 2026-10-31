'use client';

import { ErrorFallback } from '@/components/error-fallback';
import './globals.css';

// ルートレイアウトが失敗したときに layout ごと置き換えて描画される (Issue #373)。
// そのため <html>/<body> とグローバル CSS を自前で持つ。metadata は export できないので <title> で指定する
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="ja">
      <body>
        <title>エラーが発生しました | LGTMHub</title>
        <ErrorFallback retry={retry} />
      </body>
    </html>
  );
}
