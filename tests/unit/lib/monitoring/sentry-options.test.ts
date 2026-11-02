import { describe, expect, it } from 'vitest';
import { buildSentryOptions } from '@/src/lib/monitoring/sentry-options';

const DSN = 'https://publickey@o123.ingest.us.sentry.io/456';

describe('buildSentryOptions', () => {
  it('Vercel Production で DSN があるときだけ送信を有効にする', () => {
    expect(buildSentryOptions({ dsn: DSN, vercelEnv: 'production' }).enabled).toBe(true);
  });

  it.each([
    ['Preview', { dsn: DSN, vercelEnv: 'preview' }],
    ['ローカル', { dsn: DSN, vercelEnv: undefined }],
    ['DSN 未設定の本番', { dsn: undefined, vercelEnv: 'production' }],
  ])('%s では送信しない', (_, env) => {
    expect(buildSentryOptions(env).enabled).toBe(false);
  });

  it('PII を送らず、トレースを無効にする', () => {
    const options = buildSentryOptions({ dsn: DSN, vercelEnv: 'production' });
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      stackFrameVariables: false,
    });
    expect(options.tracesSampleRate).toBe(0);
  });
});
