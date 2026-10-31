import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSiteUrl, isIndexableEnvironment } from '@/src/lib/site-url';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubVercelEnv(env: {
  VERCEL_ENV?: string;
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_URL?: string;
}) {
  vi.stubEnv('VERCEL_ENV', env.VERCEL_ENV);
  vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', env.VERCEL_PROJECT_PRODUCTION_URL);
  vi.stubEnv('VERCEL_URL', env.VERCEL_URL);
}

describe('getSiteUrl', () => {
  it('Production では本番ドメインを返す', () => {
    stubVercelEnv({
      VERCEL_ENV: 'production',
      VERCEL_PROJECT_PRODUCTION_URL: 'lgtmhub.example.com',
      VERCEL_URL: 'lgtmhub-abc123.vercel.app',
    });

    expect(getSiteUrl().href).toBe('https://lgtmhub.example.com/');
  });

  it('Preview ではデプロイごとの URL を返す', () => {
    stubVercelEnv({
      VERCEL_ENV: 'preview',
      VERCEL_PROJECT_PRODUCTION_URL: 'lgtmhub.example.com',
      VERCEL_URL: 'lgtmhub-abc123.vercel.app',
    });

    expect(getSiteUrl().href).toBe('https://lgtmhub-abc123.vercel.app/');
  });

  it('Vercel 外では localhost を返す', () => {
    stubVercelEnv({});

    expect(getSiteUrl().href).toBe('http://localhost:3000/');
  });
});

describe('isIndexableEnvironment', () => {
  it.each([
    ['production', true],
    ['preview', false],
    [undefined, false],
  ])('VERCEL_ENV=%s なら %s', (vercelEnv, expected) => {
    stubVercelEnv({ VERCEL_ENV: vercelEnv });

    expect(isIndexableEnvironment()).toBe(expected);
  });
});
