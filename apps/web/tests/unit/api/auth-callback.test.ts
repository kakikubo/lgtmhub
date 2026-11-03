import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const exchangeCodeForSession = vi.fn();
const createServerClient = vi.fn(() => ({
  auth: { exchangeCodeForSession },
}));
vi.mock('@supabase/ssr', () => ({ createServerClient }));

const syncFromAuth = vi.fn();
const buildUserProfileService = vi.fn(() => ({ syncFromAuth }));
vi.mock('@/src/services/user-profile-service', () => ({ buildUserProfileService }));

beforeEach(() => {
  exchangeCodeForSession.mockReset();
  syncFromAuth.mockReset();
  createServerClient.mockClear();
  buildUserProfileService.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
});

afterEach(() => {
  vi.restoreAllMocks();
});

function buildRequest(search: string) {
  return new NextRequest(`http://localhost:3000/api/auth/callback${search}`);
}

describe('GET /api/auth/callback', () => {
  it('code が無ければ missing_code にリダイレクトし、同期しない', async () => {
    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest(''));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/?auth_error=missing_code');
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(syncFromAuth).not.toHaveBeenCalled();
  });

  it('exchange が error を返したら exchange_failed にリダイレクトし、同期しない', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'invalid code' },
    });

    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest('?code=abc'));

    expect(res.headers.get('location')).toBe('http://localhost:3000/?auth_error=exchange_failed');
    expect(syncFromAuth).not.toHaveBeenCalled();
  });

  it('正常系では exchange のユーザーで syncFromAuth を呼び、next へリダイレクトする', async () => {
    const user_metadata = {
      avatar_url: 'https://avatars.example.com/new.png',
      full_name: 'New Name',
      user_name: 'octocat',
    };
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata }, session: { access_token: 't' } },
      error: null,
    });
    syncFromAuth.mockResolvedValue(null);

    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest('?code=abc&next=/mypage'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/mypage');
    expect(buildUserProfileService).toHaveBeenCalledTimes(1);
    expect(syncFromAuth).toHaveBeenCalledWith('user-1', user_metadata);
  });

  it('syncFromAuth が reject してもログイン(リダイレクト)は成功する', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: { id: 'user-1', user_metadata: {} }, session: { access_token: 't' } },
      error: null,
    });
    syncFromAuth.mockRejectedValue(new Error('sync failed'));

    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest('?code=abc'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(syncFromAuth).toHaveBeenCalledTimes(1);
  });

  it('exchange が user を返さない場合は syncFromAuth を呼ばずリダイレクトする', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest('?code=abc'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/');
    expect(syncFromAuth).not.toHaveBeenCalled();
  });

  it('外部 URL の next は open redirect 防止で / に丸められる', async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { GET } = await import('@/app/api/auth/callback/route');
    const res = await GET(buildRequest('?code=abc&next=https://evil.example.com'));

    expect(res.headers.get('location')).toBe('http://localhost:3000/');
  });
});
