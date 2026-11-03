import { afterEach, describe, expect, it, vi } from 'vitest';
import { HOME_IMAGES_CACHE_TAG } from '@/src/services/cache/list-home-images';
import { getSitemapImageIds } from '@/src/services/cache/list-sitemap-image-ids';

const createAnonClient = vi.fn();
const listActiveImageIds = vi.fn();
const buildImageService = vi.fn();
const cacheTag = vi.fn();
const cacheLife = vi.fn();

vi.mock('next/cache', () => ({
  cacheTag: (...args: unknown[]) => cacheTag(...args),
  cacheLife: (...args: unknown[]) => cacheLife(...args),
}));

vi.mock('@/src/lib/supabase/anon', () => ({
  createAnonClient: () => createAnonClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: (...args: unknown[]) => buildImageService(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('getSitemapImageIds', () => {
  it('anon client で全 active id を取得し、一覧と同じ cacheTag を付ける', async () => {
    createAnonClient.mockReturnValue({ kind: 'anon-client' });
    buildImageService.mockReturnValue({ listActiveImageIds });
    listActiveImageIds.mockResolvedValue(['id-1', 'id-2']);

    await expect(getSitemapImageIds()).resolves.toEqual(['id-1', 'id-2']);

    expect(buildImageService).toHaveBeenCalledWith({ kind: 'anon-client' });
    expect(cacheTag).toHaveBeenCalledWith(HOME_IMAGES_CACHE_TAG);
    expect(cacheLife).toHaveBeenCalledWith('max');
  });
});
