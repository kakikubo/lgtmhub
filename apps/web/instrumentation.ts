import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, sentryEnvFromProcess } from '@/src/lib/monitoring/sentry-options';

// edge ランタイムで動くコードは無いため nodejs だけ初期化する (Issue #175)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init(buildSentryOptions(sentryEnvFromProcess()));
  }
}

// Server Component / Route Handler / Server Action で投げられた例外を捕捉する
export const onRequestError = Sentry.captureRequestError;
