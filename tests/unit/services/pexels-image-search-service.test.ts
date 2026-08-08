import { describe, expect, it, vi } from 'vitest';
import { ExternalServiceError, RateLimitedError } from '@/src/lib/errors';
import {
  buildImageSearchProvider,
  PexelsImageSearchProvider,
} from '@/src/services/image-search-service';

function buildPexelsBody(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    page: 1,
    per_page: 15,
    photos: [
      {
        id: 2014422,
        width: 3024,
        height: 3024,
        url: 'https://www.pexels.com/photo/2014422',
        photographer: 'Joey',
        photographer_url: 'https://www.pexels.com/@joey',
        alt: 'a cat',
        src: {
          medium: 'https://images.pexels.com/photos/2014422/medium.jpg',
          large: 'https://images.pexels.com/photos/2014422/large.jpg',
          original: 'https://images.pexels.com/photos/2014422/original.jpg',
        },
      },
    ],
    next_page: 'https://api.pexels.com/v1/search?page=2',
    total_results: 100,
    ...overrides,
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('PexelsImageSearchProvider.search', () => {
  it('正常系: 正規化済みの結果を返す', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(buildPexelsBody()));
    const provider = new PexelsImageSearchProvider('test-key', fetchImpl);

    const result = await provider.search({ query: 'cat' });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('https://api.pexels.com/v1/search');
    expect(calledUrl).toContain('query=cat');
    expect(calledUrl).toContain('per_page=15');
    expect(calledUrl).toContain('page=1');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toEqual({ Authorization: 'test-key' });

    expect(result).toEqual({
      results: [
        {
          id: 'pexels:2014422',
          thumbnailUrl: 'https://images.pexels.com/photos/2014422/medium.jpg',
          imageUrl: 'https://images.pexels.com/photos/2014422/large.jpg',
          width: 3024,
          height: 3024,
          alt: 'a cat',
          provider: 'pexels',
          attribution: {
            photographer: 'Joey',
            photographerUrl: 'https://www.pexels.com/@joey',
            sourceUrl: 'https://www.pexels.com/photo/2014422',
          },
        },
      ],
      page: 1,
      hasNextPage: true,
      provider: 'pexels',
    });
  });

  it('alt が null の場合は空文字に正規化する', async () => {
    const body = buildPexelsBody();
    body.photos[0]!.alt = null as unknown as string;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    const result = await provider.search({ query: 'cat' });
    expect(result.results[0]?.alt).toBe('');
  });

  it('next_page が無ければ hasNextPage = false', async () => {
    const body = buildPexelsBody();
    delete (body as { next_page?: string }).next_page;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(body));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    const result = await provider.search({ query: 'cat' });
    expect(result.hasNextPage).toBe(false);
  });

  it('429 は RateLimitedError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('rate limit', { status: 429 }));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await expect(provider.search({ query: 'cat' })).rejects.toBeInstanceOf(RateLimitedError);
  });

  it('401/403 は ExternalServiceError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('unauthorized', { status: 401 }));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await expect(provider.search({ query: 'cat' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('500 は ExternalServiceError', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await expect(provider.search({ query: 'cat' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('ネットワーク失敗は ExternalServiceError', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET'));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await expect(provider.search({ query: 'cat' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('JSON 解析失敗は ExternalServiceError', async () => {
    const broken = new Response('not-json', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
    const fetchImpl = vi.fn().mockResolvedValue(broken);
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await expect(provider.search({ query: 'cat' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('page を指定すると URL に反映される', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(buildPexelsBody({ page: 3 })));
    const provider = new PexelsImageSearchProvider('k', fetchImpl);

    await provider.search({ query: 'cat', page: 3 });
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain('page=3');
  });
});

describe('buildImageSearchProvider', () => {
  it('IMAGE_SEARCH_API_KEY 未設定なら ExternalServiceError', () => {
    expect(() => buildImageSearchProvider({})).toThrowError(ExternalServiceError);
  });

  it('未対応 provider は ExternalServiceError', () => {
    expect(() =>
      buildImageSearchProvider({
        IMAGE_SEARCH_PROVIDER: 'giphy',
        IMAGE_SEARCH_API_KEY: 'k',
      }),
    ).toThrowError(ExternalServiceError);
  });

  it('pexels で PexelsImageSearchProvider を返す', () => {
    const provider = buildImageSearchProvider({
      IMAGE_SEARCH_PROVIDER: 'pexels',
      IMAGE_SEARCH_API_KEY: 'k',
    });
    expect(provider).toBeInstanceOf(PexelsImageSearchProvider);
  });

  it('IMAGE_SEARCH_PROVIDER 未指定なら pexels と解釈する', () => {
    const provider = buildImageSearchProvider({ IMAGE_SEARCH_API_KEY: 'k' });
    expect(provider).toBeInstanceOf(PexelsImageSearchProvider);
  });
});
