type SentryEnv = {
  dsn: string | undefined;
  vercelEnv: string | undefined;
};

/**
 * client / server 共通の Sentry.init オプション。
 *
 * 本番 (Vercel Production) だけ送信する。Preview / ローカルのエラーで無料枠を消費しないため (Issue #175)。
 * 無料枠の span / replay を使わないようエラー監視に限定し、IP 等の PII は送らない。
 * Next.js の notFound() / redirect() などの制御フロー例外は SDK 側で除外済み。
 */
export function buildSentryOptions({ dsn, vercelEnv }: SentryEnv) {
  return {
    dsn,
    enabled: Boolean(dsn) && vercelEnv === 'production',
    environment: vercelEnv,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  };
}

/**
 * NEXT_PUBLIC_* はビルド時にインライン展開されるため、client バンドルでも参照できるよう
 * process.env を動的キーではなくリテラルで読む。
 */
export function sentryEnvFromProcess(): SentryEnv {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
  };
}
