'use client';

interface ErrorFallbackProps {
  /** Next.js の error.js が渡す retry()。境界の子を再取得して描画し直す */
  retry: () => void;
}

/**
 * (site)/error.tsx と global-error.tsx で共有するエラー表示 (Issue #373)。
 * Server Component 由来のエラーは本番では汎用メッセージに置き換わるため、error の中身は表示しない。
 */
export function ErrorFallback({ retry }: ErrorFallbackProps) {
  return (
    <div
      role="alert"
      data-testid="error-fallback"
      className="mx-auto max-w-6xl px-4 py-16 flex flex-col items-center gap-4 text-center"
    >
      <h1 className="text-xl font-semibold">エラーが発生しました</h1>
      <p className="text-sm text-gray-600">
        時間をおいて再試行してください。解決しない場合はトップページからやり直してください。
      </p>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => retry()}
          className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
        >
          再試行
        </button>
        {/* 壊れたクライアント状態を持ち越さないよう、next/link ではなく全体を再読み込みする */}
        <a href="/" className="text-sm text-gray-600 hover:text-gray-900">
          トップページへ戻る
        </a>
      </div>
    </div>
  );
}
