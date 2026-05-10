import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExternalServiceError, RateLimitedError } from '@/src/lib/errors';
import type { ImageSearchProvider } from '@/src/services/image-search-service';

const createClient = vi.fn();
const buildImageSearchProvider = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/image-search-service', () => ({
  buildImageSearchProvider: () => buildImageSearchProvider(),
}));

interface AuthState {
  user: { id: string } | null;
}

function buildSupabase(auth: AuthState) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: auth.user } }),
    },
  };
}

beforeEach(() => {
  createClient.mockReset();
  buildImageSearchProvider.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callGet(url: string) {
  const { GET } = await import('@/app/api/images/search/route');
  const request = new Request(url) as unknown as NextRequest;
  // GET は NextRequest を期待するので最低限 nextUrl を生やす
  Object.defineProperty(request, 'nextUrl', {
    value: new URL(url),
    configurable: true,
  });
  return GET(request);
}

const ENDPOINT = 'http://localhost/api/images/search';

describe('GET /api/images/search', () => {
  it('未ログインなら 401', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));
    const res = await callGet(`${ENDPOINT}?q=cat`);
    expect(res.status).toBe(401);
    expect(buildImageSearchProvider).not.toHaveBeenCalled();
  });

  it('q が無ければ 400', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    const res = await callGet(`${ENDPOINT}`);
    expect(res.status).toBe(400);
    expect(buildImageSearchProvider).not.toHaveBeenCalled();
  });

  it('q が空文字なら 400', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    const res = await callGet(`${ENDPOINT}?q=`);
    expect(res.status).toBe(400);
  });

  it('正常系: 200 と Cache-Control を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    const search = vi.fn().mockResolvedValue({
      results: [],
      page: 1,
      hasNextPage: false,
      provider: 'pexels',
    });
    const provider: ImageSearchProvider = { search };
    buildImageSearchProvider.mockReturnValue(provider);

    const res = await callGet(`${ENDPOINT}?q=cat&page=2`);

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('s-maxage=60');
    expect(res.headers.get('cache-control')).toContain('stale-while-revalidate=300');
    expect(search).toHaveBeenCalledWith({ query: 'cat', page: 2 });
  });

  it('provider 構築失敗時は 503', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    buildImageSearchProvider.mockImplementation(() => {
      throw new ExternalServiceError('apikey 未設定');
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet(`${ENDPOINT}?q=cat`);

    expect(res.status).toBe(503);
    consoleErrorSpy.mockRestore();
  });

  it('RateLimitedError は 503 にマップ', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    buildImageSearchProvider.mockReturnValue({
      search: vi.fn().mockRejectedValue(new RateLimitedError()),
    });

    const res = await callGet(`${ENDPOINT}?q=cat`);

    expect(res.status).toBe(503);
  });

  it('ExternalServiceError は 502 にマップ', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    buildImageSearchProvider.mockReturnValue({
      search: vi.fn().mockRejectedValue(new ExternalServiceError('upstream down')),
    });

    const res = await callGet(`${ENDPOINT}?q=cat`);

    expect(res.status).toBe(502);
  });

  it('想定外の例外は 500', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'u-1' } }));
    buildImageSearchProvider.mockReturnValue({
      search: vi.fn().mockRejectedValue(new Error('unexpected')),
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callGet(`${ENDPOINT}?q=cat`);

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
