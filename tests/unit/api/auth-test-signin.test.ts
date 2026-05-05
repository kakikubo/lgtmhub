import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithPassword = vi.fn();
const createServerClient = vi.fn(() => ({
  auth: { signInWithPassword },
}));

vi.mock('@supabase/ssr', () => ({ createServerClient }));

beforeEach(() => {
  signInWithPassword.mockReset();
  createServerClient.mockClear();
  // 既定値: 入力 ENV を毎回クリーンに
  delete process.env.E2E_TEST_MODE;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildRequest(body: unknown) {
  return new Request('http://localhost:3000/api/auth/test-signin', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('POST /api/auth/test-signin', () => {
  it('E2E_TEST_MODE が true 以外のときは 403 を返す', async () => {
    const { POST } = await import('@/app/api/auth/test-signin/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest 互換のためのテストキャスト
    const res = await POST(buildRequest({ email: 'a@example.com', password: 'pw' }) as any);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('E2E_TEST_MODE=true でも body が不正なら 400 を返す', async () => {
    process.env.E2E_TEST_MODE = 'true';

    const { POST } = await import('@/app/api/auth/test-signin/route');
    // biome-ignore lint/suspicious/noExplicitAny: NextRequest 互換のためのテストキャスト
    const res = await POST(buildRequest({ email: 'not-an-email' }) as any);
    expect(res.status).toBe(400);
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('正常系では signInWithPassword を呼んで 200 を返す', async () => {
    process.env.E2E_TEST_MODE = 'true';
    signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { access_token: 't' } },
      error: null,
    });

    const { POST } = await import('@/app/api/auth/test-signin/route');
    const res = await POST(
      // biome-ignore lint/suspicious/noExplicitAny: NextRequest 互換のためのテストキャスト
      buildRequest({ email: 'e2e@example.com', password: 'secret-pw' }) as any,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'e2e@example.com',
      password: 'secret-pw',
    });
  });

  it('signInWithPassword がエラーを返したら 401 を返す', async () => {
    process.env.E2E_TEST_MODE = 'true';
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid credentials' },
    });

    const { POST } = await import('@/app/api/auth/test-signin/route');
    const res = await POST(
      // biome-ignore lint/suspicious/noExplicitAny: NextRequest 互換のためのテストキャスト
      buildRequest({ email: 'e2e@example.com', password: 'wrong' }) as any,
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: 'signin_failed' });
  });

  it('user 未返却でも 401 にフォールバックする', async () => {
    process.env.E2E_TEST_MODE = 'true';
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { POST } = await import('@/app/api/auth/test-signin/route');
    const res = await POST(
      // biome-ignore lint/suspicious/noExplicitAny: NextRequest 互換のためのテストキャスト
      buildRequest({ email: 'e2e@example.com', password: 'pw' }) as any,
    );

    expect(res.status).toBe(401);
  });
});
