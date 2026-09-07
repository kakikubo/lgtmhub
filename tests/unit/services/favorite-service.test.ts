import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DuplicateFavoriteError, NotFoundError } from '@/src/lib/errors';
import { LIST_FAVORITES_DEFAULT_LIMIT } from '@/src/lib/validation/favorite';
import type { FavoriteRepository, FavoriteWithImage } from '@/src/repositories/favorite-repository';
import type { ImageRepository } from '@/src/repositories/image-repository';
import { buildFavoriteService, FavoriteService } from '@/src/services/favorite-service';
import type { Database } from '@/src/types/database.types';
import type { Favorite } from '@/src/types/favorite';
import type { LgtmImage } from '@/src/types/image';

const USER_ID = 'user-1';
const IMAGE_ID = 'image-1';

function buildImage(overrides: Partial<LgtmImage> = {}): LgtmImage {
  return {
    id: IMAGE_ID,
    uploaderId: 'uploader-1',
    originalUrl: 'https://example.com/source.jpg',
    imageUrl: 'https://blob.example.com/lgtm/image-1.webp',
    pHash: '0'.repeat(1024),
    width: 266,
    height: 199,
    fileSizeBytes: 12345,
    mimeType: 'image/webp',
    isAnimated: false,
    status: 'active',
    deletedAt: null,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildFavorite(overrides: Partial<Favorite> = {}): Favorite {
  return {
    id: 'fav-1',
    userId: USER_ID,
    lgtmImageId: IMAGE_ID,
    createdAt: new Date('2026-08-20T00:00:00.000Z'),
    ...overrides,
  };
}

function buildFavoriteWithImage(index: number): FavoriteWithImage {
  const favoritedAt = new Date(Date.UTC(2026, 7, 20, 0, 0, index));
  return {
    image: {
      id: `image-${index}`,
      imageUrl: `https://blob.example.com/lgtm/image-${index}.webp`,
      uploaderId: 'uploader-1',
      width: 266,
      height: 199,
      isAnimated: false,
      createdAt: favoritedAt,
    },
    favoritedAt,
  };
}

interface Stubs {
  favoriteRepo: {
    create: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    listWithImages: ReturnType<typeof vi.fn>;
    listImageIds: ReturnType<typeof vi.fn>;
  };
  imageRepo: {
    findActiveById: ReturnType<typeof vi.fn>;
  };
}

function createService(): { service: FavoriteService } & Stubs {
  const favoriteRepo = {
    create: vi.fn(),
    delete: vi.fn(),
    listWithImages: vi.fn(),
    listImageIds: vi.fn(),
  };
  const imageRepo = { findActiveById: vi.fn() };
  const service = new FavoriteService({
    favoriteRepo: favoriteRepo as unknown as FavoriteRepository,
    imageRepo: imageRepo as unknown as ImageRepository,
  });
  return { service, favoriteRepo, imageRepo };
}

describe('FavoriteService.addFavorite', () => {
  it('active な画像なら登録して Favorite を返す', async () => {
    const { service, favoriteRepo, imageRepo } = createService();
    imageRepo.findActiveById.mockResolvedValue(buildImage());
    favoriteRepo.create.mockResolvedValue(buildFavorite());

    const favorite = await service.addFavorite(USER_ID, IMAGE_ID);

    expect(favorite.id).toBe('fav-1');
    expect(imageRepo.findActiveById).toHaveBeenCalledWith(IMAGE_ID);
    expect(favoriteRepo.create).toHaveBeenCalledWith(USER_ID, IMAGE_ID);
  });

  it('画像が存在しない / 論理削除済みなら NotFoundError で INSERT しない', async () => {
    const { service, favoriteRepo, imageRepo } = createService();
    imageRepo.findActiveById.mockResolvedValue(null);

    await expect(service.addFavorite(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(NotFoundError);
    expect(favoriteRepo.create).not.toHaveBeenCalled();
  });

  it('Repository の DuplicateFavoriteError をそのまま伝播する', async () => {
    const { service, favoriteRepo, imageRepo } = createService();
    imageRepo.findActiveById.mockResolvedValue(buildImage());
    favoriteRepo.create.mockRejectedValue(new DuplicateFavoriteError());

    await expect(service.addFavorite(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(
      DuplicateFavoriteError,
    );
  });
});

describe('FavoriteService.removeFavorite', () => {
  it('1 行削除できれば解決する', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.delete.mockResolvedValue(1);

    await expect(service.removeFavorite(USER_ID, IMAGE_ID)).resolves.toBeUndefined();
    expect(favoriteRepo.delete).toHaveBeenCalledWith(USER_ID, IMAGE_ID);
  });

  it('削除行数 0 (未登録 / 他人の行) なら NotFoundError', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.delete.mockResolvedValue(0);

    await expect(service.removeFavorite(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('FavoriteService.listFavorites', () => {
  it('limit 未指定なら既定値で Repository を呼ぶ', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.listWithImages.mockResolvedValue([]);

    const result = await service.listFavorites({ userId: USER_ID });

    expect(favoriteRepo.listWithImages).toHaveBeenCalledWith({
      userId: USER_ID,
      cursor: undefined,
      limit: LIST_FAVORITES_DEFAULT_LIMIT,
    });
    expect(result).toEqual({ images: [], nextCursor: null });
  });

  it('limit ちょうど返ってきたら末尾のお気に入り登録日時を nextCursor にする', async () => {
    const { service, favoriteRepo } = createService();
    const records = [buildFavoriteWithImage(0), buildFavoriteWithImage(1)];
    favoriteRepo.listWithImages.mockResolvedValue(records);

    const result = await service.listFavorites({ userId: USER_ID, limit: 2 });

    expect(result.images).toHaveLength(2);
    expect(result.nextCursor).toBe(records[1]?.favoritedAt.toISOString());
  });

  it('limit 未満なら nextCursor は null (最終ページ)', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.listWithImages.mockResolvedValue([buildFavoriteWithImage(0)]);

    const result = await service.listFavorites({ userId: USER_ID, limit: 2 });

    expect(result.nextCursor).toBeNull();
  });

  it('cursor をそのまま Repository へ渡す', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.listWithImages.mockResolvedValue([]);

    await service.listFavorites({ userId: USER_ID, cursor: '2026-08-19T00:00:00.000Z', limit: 5 });

    expect(favoriteRepo.listWithImages).toHaveBeenCalledWith({
      userId: USER_ID,
      cursor: '2026-08-19T00:00:00.000Z',
      limit: 5,
    });
  });

  it('返す画像の createdAt はお気に入り登録日時である', async () => {
    const { service, favoriteRepo } = createService();
    const record = buildFavoriteWithImage(3);
    favoriteRepo.listWithImages.mockResolvedValue([record]);

    const result = await service.listFavorites({ userId: USER_ID, limit: 20 });

    expect(result.images[0]?.createdAt).toEqual(record.favoritedAt);
  });
});

describe('FavoriteService.listFavoriteImageIds', () => {
  it('Repository の結果をそのまま返す', async () => {
    const { service, favoriteRepo } = createService();
    favoriteRepo.listImageIds.mockResolvedValue(['a', 'b']);

    await expect(service.listFavoriteImageIds(USER_ID)).resolves.toEqual(['a', 'b']);
    expect(favoriteRepo.listImageIds).toHaveBeenCalledWith(USER_ID);
  });
});

describe('buildFavoriteService', () => {
  it('SupabaseClient から FavoriteService を組み立てる', () => {
    const supabase = { from: vi.fn() } as unknown as SupabaseClient<Database>;
    expect(buildFavoriteService(supabase)).toBeInstanceOf(FavoriteService);
  });
});
