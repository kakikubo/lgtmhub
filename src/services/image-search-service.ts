import { ExternalServiceError, RateLimitedError } from '@/src/lib/errors';
import {
  IMAGE_SEARCH_PER_PAGE,
  type ImageSearchProviderId,
  type ImageSearchResult,
  SUPPORTED_IMAGE_SEARCH_PROVIDERS,
} from '@/src/lib/validation/image-search';

export const PEXELS_SEARCH_ENDPOINT = 'https://api.pexels.com/v1/search';
export const PEXELS_FETCH_TIMEOUT_MS = 8_000;

export interface ImageSearchParams {
  query: string;
  page?: number;
}

export interface ImageSearchResultPage {
  results: ImageSearchResult[];
  page: number;
  hasNextPage: boolean;
  provider: ImageSearchProviderId;
}

export interface ImageSearchProvider {
  search(params: ImageSearchParams): Promise<ImageSearchResultPage>;
}

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  url: string;
  photographer: string;
  photographer_url: string;
  alt: string | null;
  src: {
    medium: string;
    large: string;
    original: string;
  };
}

interface PexelsSearchResponse {
  page: number;
  per_page: number;
  photos: PexelsPhoto[];
  next_page?: string;
  total_results: number;
}

export class PexelsImageSearchProvider implements ImageSearchProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = PEXELS_FETCH_TIMEOUT_MS,
  ) {}

  async search({ query, page }: ImageSearchParams): Promise<ImageSearchResultPage> {
    const url = new URL(PEXELS_SEARCH_ENDPOINT);
    url.searchParams.set('query', query);
    url.searchParams.set('per_page', String(IMAGE_SEARCH_PER_PAGE));
    url.searchParams.set('page', String(page ?? 1));

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        headers: { Authorization: this.apiKey },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new ExternalServiceError(
        err instanceof Error && err.name === 'TimeoutError'
          ? '画像検索がタイムアウトしました'
          : '画像検索に失敗しました',
      );
    }

    if (response.status === 429) {
      throw new RateLimitedError();
    }
    if (!response.ok) {
      throw new ExternalServiceError(`Pexels API が ${response.status} を返しました`);
    }

    let body: PexelsSearchResponse;
    try {
      // Response.json() の戻り値は any 相当 (DOM の型定義) なので Pexels 公式仕様に従いキャスト。
      // 想定外フィールドは正規化時に握りつぶす方針 (alt: null → '' 等)
      body = (await response.json()) as PexelsSearchResponse;
    } catch {
      throw new ExternalServiceError('画像検索のレスポンスを解析できませんでした');
    }

    const results: ImageSearchResult[] = body.photos.map((photo) => ({
      id: `pexels:${photo.id}`,
      thumbnailUrl: photo.src.medium,
      imageUrl: photo.src.large,
      width: photo.width,
      height: photo.height,
      alt: photo.alt ?? '',
      provider: 'pexels',
      attribution: {
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        sourceUrl: photo.url,
      },
    }));

    return {
      results,
      page: body.page,
      hasNextPage: typeof body.next_page === 'string' && body.next_page.length > 0,
      provider: 'pexels',
    };
  }
}

export function buildImageSearchProvider(
  env: Record<string, string | undefined> = process.env,
): ImageSearchProvider {
  const provider = env.IMAGE_SEARCH_PROVIDER ?? 'pexels';
  const apiKey = env.IMAGE_SEARCH_API_KEY;
  if (!apiKey) {
    throw new ExternalServiceError('画像検索プロバイダーの API キーが設定されていません');
  }
  if (!SUPPORTED_IMAGE_SEARCH_PROVIDERS.includes(provider as ImageSearchProviderId)) {
    throw new ExternalServiceError(`未対応の画像検索プロバイダーです: ${provider}`);
  }
  switch (provider as ImageSearchProviderId) {
    case 'pexels':
      return new PexelsImageSearchProvider(apiKey);
  }
}
