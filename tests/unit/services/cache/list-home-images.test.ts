import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getHomeImagesInitial, HOME_IMAGES_CACHE_TAG } from '@/src/services/cache/list-home-images';
import type { ListImagesResult } from '@/src/services/image-service';

const createAnonClient = vi.fn();
const listImages = vi.fn();
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

const RESULT: ListImagesResult = {
  images: [],
  nextCursor: null,
};

beforeEach(() => {
  createAnonClient.mockReset();
  listImages.mockReset();
  buildImageService.mockReset();
  cacheTag.mockReset();
  cacheLife.mockReset();

  const supabase = { kind: 'anon-client' };
  createAnonClient.mockReturnValue(supabase);
  buildImageService.mockReturnValue({ listImages });
  listImages.mockResolvedValue(RESULT);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getHomeImagesInitial', () => {
  it('anon client で listImages を呼び、cacheTag と cacheLife を設定する', async () => {
    await expect(getHomeImagesInitial()).resolves.toEqual(RESULT);

    expect(createAnonClient).toHaveBeenCalledTimes(1);
    expect(buildImageService).toHaveBeenCalledWith({ kind: 'anon-client' });
    expect(listImages).toHaveBeenCalledTimes(1);
    expect(cacheTag).toHaveBeenCalledWith(HOME_IMAGES_CACHE_TAG);
    expect(cacheLife).toHaveBeenCalledWith('max');
  });
});
