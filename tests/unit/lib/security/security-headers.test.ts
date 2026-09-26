import { describe, expect, it } from 'vitest';
import { buildContentSecurityPolicy } from '@/src/lib/security/security-headers';

function parse(policy: string): Map<string, string[]> {
  const directives = new Map<string, string[]>();
  for (const directive of policy.split('; ')) {
    const [name = '', ...sources] = directive.split(' ');
    directives.set(name, sources);
  }
  return directives;
}

describe('buildContentSecurityPolicy', () => {
  const production = parse(
    buildContentSecurityPolicy({ supabaseUrl: 'https://example.supabase.co/', isDev: false }),
  );

  it('画像は self と Blob / GitHub アバターだけを許可する', () => {
    expect(production.get('img-src')).toEqual([
      "'self'",
      'https://*.public.blob.vercel-storage.com',
      'https://avatars.githubusercontent.com',
    ]);
  });

  it('本番では eval と外部スクリプト・WebSocket を許可しない', () => {
    expect(production.get('script-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(production.get('connect-src')).toEqual(["'self'"]);
  });

  it('form-action に Supabase のオリジン (パスなし) と GitHub を含める', () => {
    expect(production.get('form-action')).toEqual([
      "'self'",
      'https://example.supabase.co',
      'https://github.com',
    ]);
  });

  it('埋め込みとプラグインを禁止する', () => {
    expect(production.get('frame-ancestors')).toEqual(["'none'"]);
    expect(production.get('object-src')).toEqual(["'none'"]);
  });

  it('dev では eval・Vercel Analytics のデバッグスクリプト・HMR の WebSocket を許可する', () => {
    const dev = parse(buildContentSecurityPolicy({ supabaseUrl: undefined, isDev: true }));
    expect(dev.get('script-src')).toEqual([
      "'self'",
      "'unsafe-inline'",
      "'unsafe-eval'",
      'https://va.vercel-scripts.com',
    ]);
    expect(dev.get('connect-src')).toEqual(["'self'", 'ws:']);
  });

  it.each([undefined, 'not a url'])(
    'Supabase URL が %s なら form-action に足さない',
    (supabaseUrl) => {
      const policy = parse(buildContentSecurityPolicy({ supabaseUrl, isDev: false }));
      expect(policy.get('form-action')).toEqual(["'self'", 'https://github.com']);
    },
  );
});
