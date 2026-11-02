import * as Sentry from '@sentry/nextjs';
import { buildSentryOptions, sentryEnvFromProcess } from '@/src/lib/monitoring/sentry-options';

// Session Replay / トレースは無料枠を消費するため integrations に足さない (Issue #175)
Sentry.init(buildSentryOptions(sentryEnvFromProcess()));
