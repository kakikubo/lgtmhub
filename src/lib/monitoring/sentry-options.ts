import type { init } from '@sentry/nextjs';

type SentryEnv = {
  dsn: string | undefined;
  vercelEnv: string | undefined;
};

type SentryInitOptions = NonNullable<Parameters<typeof init>[0]>;

/**
 * client / server 共通の Sentry.init オプション。
 *
 * 本番 (Vercel Production) だけ送信する。Preview / ローカルのエラーで無料枠を消費しないため (Issue #175)。
 * 無料枠の span / replay を使わないようエラー監視に限定し、IP 等の PII は送らない。
 * Next.js の notFound() / redirect() などの制御フロー例外は SDK 側で除外済み。
 *
 * `satisfies` で SDK の型に照合し、SDK が参照しないオプションを書くと型エラーにする。
 * SDK 11 は `sendDefaultPii` を参照せず、指定しても黙って無視されていた。
 */
export function buildSentryOptions({ dsn, vercelEnv }: SentryEnv) {
  return {
    dsn,
    enabled: Boolean(dsn) && vercelEnv === 'production',
    environment: vercelEnv,
    // SDK 11 の既定は IP・Cookie・ヘッダー・リクエスト本文・クエリ・ローカル変数をすべて収集する。
    // スタックトレースと発生箇所だけを送る (Issue #175)。クエリには OAuth の code、ローカル変数には
    // ユーザー ID が入りうるため、これらも止める
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    },
    tracesSampleRate: 0,
  } satisfies SentryInitOptions;
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
