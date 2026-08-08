'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CREATE_IMAGE_FALLBACK_MESSAGE,
  mapCreateImageError,
} from '@/src/lib/validation/create-image-error';
import { createImageResponseSchema } from '@/src/lib/validation/image';
import {
  type ImageSearchResult,
  imageSearchErrorResponseSchema,
  imageSearchQuerySchema,
  imageSearchResponseSchema,
} from '@/src/lib/validation/image-search';

type Status = 'idle' | 'searching' | 'submitting';

interface SearchState {
  results: ImageSearchResult[];
  page: number;
  hasNextPage: boolean;
  query: string;
}

const INITIAL_STATE: SearchState = {
  results: [],
  page: 0,
  hasNextPage: false,
  query: '',
};

const SEARCH_FALLBACK_MESSAGE = '画像検索に失敗しました。時間をおいて再度お試しください';

class SearchRequestError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly httpStatus: number,
  ) {
    super(userMessage);
    this.name = 'SearchRequestError';
  }
}

function mapSearchError(status: number, body: unknown): string {
  const parsed = imageSearchErrorResponseSchema.safeParse(body);
  const errorText = parsed.success ? parsed.data.error : null;
  switch (status) {
    case 400:
      return errorText ? `入力値が正しくありません: ${errorText}` : '入力値が正しくありません';
    case 401:
      return 'セッションが切れました。再度ログインしてからお試しください';
    case 503:
      return '画像検索が混雑しています。少し待ってから再度お試しください';
    case 502:
      return errorText ?? SEARCH_FALLBACK_MESSAGE;
    default:
      return SEARCH_FALLBACK_MESSAGE;
  }
}

export function ImageSearchPicker() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [search, setSearch] = useState<SearchState>(INITIAL_STATE);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [needsRelogin, setNeedsRelogin] = useState(false);
  const [emptyHit, setEmptyHit] = useState(false);

  const fetchPage = async (query: string, page: number) => {
    const url = `/api/images/search?q=${encodeURIComponent(query)}&page=${page}`;
    const res = await fetch(url, { cache: 'no-store' });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      throw new SearchRequestError(mapSearchError(res.status, json), res.status);
    }
    const parsed = imageSearchResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new SearchRequestError(SEARCH_FALLBACK_MESSAGE, 0);
    }
    return parsed.data;
  };

  const handleSearchSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== 'idle') return;

    setErrorMessage(null);
    setNeedsRelogin(false);
    setEmptyHit(false);

    const trimmed = keyword.trim();
    const validated = imageSearchQuerySchema.safeParse({ q: trimmed });
    if (!validated.success) {
      setErrorMessage(validated.error.issues[0]?.message ?? '入力値が不正です');
      return;
    }

    setStatus('searching');
    setSelectedId(null);
    try {
      const data = await fetchPage(validated.data.q, 1);
      setSearch({
        query: validated.data.q,
        results: data.results,
        page: data.page,
        hasNextPage: data.hasNextPage,
      });
      setEmptyHit(data.results.length === 0);
    } catch (err) {
      if (err instanceof SearchRequestError) {
        setErrorMessage(err.userMessage);
        if (err.httpStatus === 401) setNeedsRelogin(true);
      } else {
        setErrorMessage(SEARCH_FALLBACK_MESSAGE);
      }
      setSearch(INITIAL_STATE);
    } finally {
      setStatus('idle');
    }
  };

  const handleLoadMore = async () => {
    if (status !== 'idle' || !search.hasNextPage || !search.query) return;
    setErrorMessage(null);
    setStatus('searching');
    try {
      const data = await fetchPage(search.query, search.page + 1);
      setSearch((prev) => ({
        ...prev,
        results: [...prev.results, ...data.results],
        page: data.page,
        hasNextPage: data.hasNextPage,
      }));
    } catch (err) {
      const message = err instanceof SearchRequestError ? err.userMessage : SEARCH_FALLBACK_MESSAGE;
      setErrorMessage(message);
    } finally {
      setStatus('idle');
    }
  };

  const handleSubmitSelected = async () => {
    if (status !== 'idle') return;
    const selected = search.results.find((r) => r.id === selectedId);
    if (!selected) return;

    setErrorMessage(null);
    setNeedsRelogin(false);
    setStatus('submitting');
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: selected.imageUrl }),
      });
      const json: unknown = await res.json().catch(() => null);

      if (res.ok) {
        const parsed = createImageResponseSchema.safeParse(json);
        if (!parsed.success) {
          setErrorMessage(CREATE_IMAGE_FALLBACK_MESSAGE);
          return;
        }
        router.refresh();
        router.push('/');
        return;
      }

      const mapped = mapCreateImageError(res.status, json);
      setErrorMessage(mapped.message);
      if (mapped.needsRelogin) setNeedsRelogin(true);
    } catch {
      setErrorMessage(CREATE_IMAGE_FALLBACK_MESSAGE);
    } finally {
      setStatus('idle');
    }
  };

  const isSearching = status === 'searching';
  const isSubmitting = status === 'submitting';
  const isBusy = isSearching || isSubmitting;

  return (
    <div className="space-y-4" data-testid="image-search-picker">
      <form onSubmit={handleSearchSubmit} className="flex gap-2" noValidate>
        <input
          type="search"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="例: cat, thumbs up, ハイタッチ"
          aria-label="検索キーワード"
          data-testid="image-search-keyword-input"
          disabled={isBusy}
          maxLength={100}
          className="flex-1 border rounded px-3 py-2 text-sm disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={isBusy}
          data-testid="image-search-submit"
          aria-busy={isSearching}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isSearching ? '検索中…' : '検索'}
        </button>
      </form>

      {errorMessage ? (
        <p role="alert" data-testid="image-search-error" className="text-sm text-red-600">
          {errorMessage}
          {needsRelogin ? (
            <>
              {' '}
              <Link href="/?auth_error=login_required" className="underline hover:text-red-800">
                トップへ戻る
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      {emptyHit ? (
        <p data-testid="image-search-empty" className="text-sm text-gray-600">
          該当する画像が見つかりませんでした。別のキーワードをお試しください。
        </p>
      ) : null}

      {search.results.length > 0 ? (
        <ul
          data-testid="image-search-results"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
        >
          {search.results.map((result) => {
            const selected = result.id === selectedId;
            return (
              <li key={result.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(result.id)}
                  aria-pressed={selected}
                  data-testid="image-search-result"
                  data-selected={selected ? 'true' : 'false'}
                  disabled={isSubmitting}
                  className={
                    selected
                      ? 'block w-full overflow-hidden rounded border-2 border-gray-900 ring-2 ring-gray-900/30'
                      : 'block w-full overflow-hidden rounded border border-gray-200 hover:border-gray-400'
                  }
                >
                  <div className="relative w-full h-32">
                    {/* 外部 (Pexels) サムネは next.config.ts の remotePatterns に追加せず、
                        unoptimized で素のままレンダリングする */}
                    <Image
                      src={result.thumbnailUrl}
                      alt={result.alt}
                      fill
                      sizes="(min-width: 768px) 25vw, 50vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {search.hasNextPage ? (
        <div className="text-center">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isBusy}
            data-testid="image-search-load-more"
            className="text-sm border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {isSearching ? '読み込み中…' : 'もっと見る'}
          </button>
        </div>
      ) : null}

      {selectedId ? (
        <div className="space-y-2">
          <SelectedAttribution
            attribution={search.results.find((r) => r.id === selectedId)?.attribution}
          />
          <button
            type="button"
            onClick={handleSubmitSelected}
            disabled={isBusy}
            data-testid="image-search-register-submit"
            aria-busy={isSubmitting}
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {isSubmitting ? '登録中…' : 'この画像で登録する'}
          </button>
        </div>
      ) : null}

      <p className="text-xs text-gray-500">
        画像は{' '}
        <a
          href="https://www.pexels.com"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-gray-700"
        >
          Pexels
        </a>{' '}
        から検索しています。
      </p>
    </div>
  );
}

function SelectedAttribution({ attribution }: { attribution?: ImageSearchResult['attribution'] }) {
  if (!attribution) return null;
  return (
    <p className="text-xs text-gray-500">
      撮影:{' '}
      <a
        href={attribution.photographerUrl}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-gray-700"
      >
        {attribution.photographer}
      </a>
      {' / '}
      <a
        href={attribution.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="underline hover:text-gray-700"
      >
        Pexels で見る
      </a>
    </p>
  );
}
