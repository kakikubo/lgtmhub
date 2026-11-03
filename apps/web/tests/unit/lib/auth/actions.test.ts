import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.fn();
const signOut = vi.fn();
const createClient = vi.fn(async () => ({
  auth: { signInWithOAuth, signOut },
}));
const headers = vi.fn(async () => new Headers());
const redirect = vi.fn((url: string) => {
  // Next.js の redirect は内部で throw してフレームワークが拾う実装。
  // テストでは呼び出し履歴を確認できれば十分なので throw のフリだけする
  throw new Error(`__REDIRECT__:${url}`);
});

vi.mock('@/src/lib/supabase/server', () => ({ createClient }));
vi.mock('next/headers', () => ({ headers }));
vi.mock('next/navigation', () => ({ redirect }));

beforeEach(() => {
  signInWithOAuth.mockReset();
  signOut.mockReset();
  createClient.mockClear();
  headers.mockReset();
  headers.mockImplementation(async () => new Headers());
  redirect.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('signInWithGithub', () => {
  it('Supabase が返した authorize URL に redirect する', async () => {
    headers.mockImplementation(
      async () =>
        new Headers({
          origin: 'https://example.com',
        }),
    );
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://supabase.example/oauth' },
      error: null,
    });

    const { signInWithGithub } = await import('@/src/lib/auth/actions');
    await expect(signInWithGithub()).rejects.toThrow('__REDIRECT__:https://supabase.example/oauth');

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'https://example.com/api/auth/callback' },
    });
    expect(redirect).toHaveBeenCalledWith('https://supabase.example/oauth');
  });

  it('origin ヘッダがない場合は x-forwarded-proto と host から組み立てる', async () => {
    headers.mockImplementation(
      async () =>
        new Headers({
          'x-forwarded-proto': 'https',
          host: 'lgtmhub.example',
        }),
    );
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://supabase.example/oauth' },
      error: null,
    });

    const { signInWithGithub } = await import('@/src/lib/auth/actions');
    await expect(signInWithGithub()).rejects.toThrow();

    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'github',
      options: { redirectTo: 'https://lgtmhub.example/api/auth/callback' },
    });
  });

  it('Supabase がエラーを返した場合は auth_error クエリ付きで `/` に redirect する', async () => {
    signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: 'oauth misconfigured' },
    });

    const { signInWithGithub } = await import('@/src/lib/auth/actions');
    await expect(signInWithGithub()).rejects.toThrow('__REDIRECT__:/?auth_error=signin_failed');
    expect(redirect).toHaveBeenCalledWith('/?auth_error=signin_failed');
  });

  it('data.url が空の場合も auth_error にフォールバックする', async () => {
    signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    const { signInWithGithub } = await import('@/src/lib/auth/actions');
    await expect(signInWithGithub()).rejects.toThrow('__REDIRECT__:/?auth_error=signin_failed');
  });
});

describe('signOut', () => {
  it('Supabase の signOut を呼んだ後、トップへ redirect する', async () => {
    signOut.mockResolvedValue({ error: null });

    const { signOut: action } = await import('@/src/lib/auth/actions');
    await expect(action()).rejects.toThrow('__REDIRECT__:/');

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith('/');
  });
});
