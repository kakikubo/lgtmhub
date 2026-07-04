import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DailyLimitExceededError,
  DatabaseError,
  DuplicateImageError,
  ForbiddenError,
  NotFoundError,
} from '@/src/lib/errors';
import { LIST_IMAGES_DEFAULT_LIMIT } from '@/src/lib/validation/image';
import type { DailyUploadCountRepository } from '@/src/repositories/daily-upload-count-repository';
import type { ImageRepository } from '@/src/repositories/image-repository';
import { BLOB_CACHE_CONTROL_MAX_AGE_SECONDS, type BlobClient } from '@/src/services/image-service';
import type { Database } from '@/src/types/database.types';
import type { LgtmImage } from '@/src/types/image';

const safeFetch = vi.fn();
const validateImage = vi.fn();
const calculatePHash = vi.fn();
const isDuplicate = vi.fn();
const composeLgtmImage = vi.fn();
const blobPut = vi.fn();
const blobDel = vi.fn();

vi.mock('@/src/lib/http/safe-fetch', () => ({
  safeFetch: (...args: unknown[]) => safeFetch(...args),
  DEFAULT_MAX_FETCH_BYTES: 10 * 1024 * 1024,
  DEFAULT_FETCH_TIMEOUT_MS: 8000,
  DEFAULT_ALLOWED_CONTENT_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
}));

vi.mock('@/src/lib/image/validate-image', () => ({
  validateImage: (...args: unknown[]) => validateImage(...args),
  ALLOWED_IMAGE_FORMATS: ['jpeg', 'png', 'gif', 'webp'],
}));

vi.mock('@/src/lib/image/calculate-phash', () => ({
  calculatePHash: (...args: unknown[]) => calculatePHash(...args),
  isDuplicate: (...args: unknown[]) => isDuplicate(...args),
  hammingDistance: () => 0,
  DUPLICATE_THRESHOLD: 10,
  PHASH_LENGTH: 1024,
}));

vi.mock('@/src/lib/image/compose-lgtm', () => ({
  composeLgtmImage: (...args: unknown[]) => composeLgtmImage(...args),
  MAX_LONG_SIDE: 400,
  WEBP_QUALITY: 85,
}));

vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => blobPut(...args),
  del: (...args: unknown[]) => blobDel(...args),
}));

beforeEach(() => {
  safeFetch.mockReset();
  validateImage.mockReset();
  calculatePHash.mockReset();
  isDuplicate.mockReset();
  composeLgtmImage.mockReset();
  blobPut.mockReset();
  blobDel.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

interface Mocks {
  imageRepo: {
    create: ReturnType<typeof vi.fn>;
    listActivePHashes: ReturnType<typeof vi.fn>;
    listActivePHashesExcept: ReturnType<typeof vi.fn>;
    updateAfterRegenerate: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
    findActiveById: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    listActiveIds: ReturnType<typeof vi.fn>;
    findManyActiveByIds: ReturnType<typeof vi.fn>;
  };
  countRepo: { getCount: ReturnType<typeof vi.fn>; increment: ReturnType<typeof vi.fn> };
  blob: {
    put: ReturnType<typeof vi.fn<BlobClient['put']>>;
    del: ReturnType<typeof vi.fn<BlobClient['del']>>;
  };
  clock: () => Date;
}

function buildMocks(): Mocks {
  return {
    imageRepo: {
      create: vi.fn(),
      listActivePHashes: vi.fn().mockResolvedValue([]),
      listActivePHashesExcept: vi.fn().mockResolvedValue([]),
      updateAfterRegenerate: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      findActiveById: vi.fn(),
      softDelete: vi.fn(),
      listActiveIds: vi.fn().mockResolvedValue([]),
      findManyActiveByIds: vi.fn().mockResolvedValue([]),
    },
    countRepo: {
      getCount: vi.fn().mockResolvedValue(0),
      increment: vi.fn().mockResolvedValue(1),
    },
    blob: {
      put: vi
        .fn<BlobClient['put']>()
        .mockResolvedValue({ url: 'https://blob.example/lgtm/x.webp' }),
      del: vi.fn<BlobClient['del']>().mockResolvedValue(undefined),
    },
    clock: () => new Date('2026-05-04T12:00:00.000Z'),
  };
}

function buildImage(overrides: Partial<LgtmImage> = {}): LgtmImage {
  return {
    id: 'image-1',
    uploaderId: 'user-1',
    originalUrl: 'https://example.com/source.jpg',
    imageUrl: 'https://blob.example/lgtm/x.webp',
    pHash: '0'.repeat(1024),
    width: 800,
    height: 600,
    fileSizeBytes: 12345,
    mimeType: 'image/webp',
    isAnimated: false,
    status: 'active',
    deletedAt: null,
    createdAt: new Date('2026-05-04T12:00:00.000Z'),
    updatedAt: new Date('2026-05-04T12:00:00.000Z'),
    ...overrides,
  };
}

async function buildService(mocks: Mocks) {
  const { ImageService } = await import('@/src/services/image-service');
  return new ImageService({
    imageRepo: mocks.imageRepo as unknown as ImageRepository,
    countRepo: mocks.countRepo as unknown as DailyUploadCountRepository,
    blob: mocks.blob,
    clock: mocks.clock,
  });
}

function setupHappyPathMocks(): void {
  safeFetch.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
  validateImage.mockResolvedValue({ format: 'jpeg', width: 800, height: 600, pages: 1 });
  calculatePHash.mockResolvedValue('b'.repeat(1024));
  isDuplicate.mockReturnValue(false);
  composeLgtmImage.mockResolvedValue({
    buffer: Buffer.from('webp'),
    width: 400,
    height: 300,
    byteLength: 4,
    isAnimated: false,
  });
}

describe('ImageService.createImage', () => {
  it('preflight で 1 日の上限を超えていれば DailyLimitExceededError を throw する', async () => {
    const mocks = buildMocks();
    mocks.countRepo.getCount.mockResolvedValue(10);

    const service = await buildService(mocks);

    await expect(service.createImage('user-1', 'https://example.com/x.jpg')).rejects.toBeInstanceOf(
      DailyLimitExceededError,
    );
    expect(mocks.countRepo.getCount).toHaveBeenCalledWith('user-1', '2026-05-04');
    expect(safeFetch).not.toHaveBeenCalled();
    expect(mocks.countRepo.increment).not.toHaveBeenCalled();
  });

  it('既存画像と pHash が重複したら DuplicateImageError を throw し、increment / Blob は呼ばれない', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActivePHashes.mockResolvedValue([
      { id: 'existing-1', pHash: 'a'.repeat(1024) },
    ]);

    safeFetch.mockResolvedValue({ buffer: Buffer.from('img'), contentType: 'image/jpeg' });
    validateImage.mockResolvedValue({ format: 'jpeg', width: 800, height: 600, pages: 1 });
    calculatePHash.mockResolvedValue('a'.repeat(1024));
    isDuplicate.mockReturnValueOnce(true);

    const service = await buildService(mocks);

    const promise = service.createImage('user-1', 'https://example.com/x.jpg');
    await expect(promise).rejects.toBeInstanceOf(DuplicateImageError);
    await expect(promise).rejects.toMatchObject({ existingImageId: 'existing-1' });

    expect(isDuplicate).toHaveBeenCalledTimes(1);
    expect(mocks.countRepo.increment).not.toHaveBeenCalled();
    expect(mocks.blob.put).not.toHaveBeenCalled();
    expect(mocks.imageRepo.create).not.toHaveBeenCalled();
  });

  it('正常系: Blob 保存 → increment → DB 登録 の順で実行する', async () => {
    // Blob put を先に済ませることで、合成失敗時に daily 枠を無駄消費しない
    const mocks = buildMocks();
    setupHappyPathMocks();
    mocks.imageRepo.create.mockResolvedValue(buildImage());

    const callOrder: string[] = [];
    mocks.countRepo.increment.mockImplementation(async () => {
      callOrder.push('increment');
      return 1;
    });
    mocks.blob.put.mockImplementation(async () => {
      callOrder.push('blob.put');
      return { url: 'https://blob.example/lgtm/x.webp' };
    });
    mocks.imageRepo.create.mockImplementation(async () => {
      callOrder.push('imageRepo.create');
      return buildImage();
    });

    const service = await buildService(mocks);
    const result = await service.createImage('user-1', 'https://example.com/x.jpg');

    expect(result.id).toBe('image-1');
    expect(callOrder).toEqual(['blob.put', 'increment', 'imageRepo.create']);
    expect(mocks.blob.put).toHaveBeenCalledWith(
      expect.stringMatching(/^lgtm\/[0-9a-f-]+\.webp$/),
      Buffer.from('webp'),
      'image/webp',
    );
    expect(mocks.imageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        uploaderId: 'user-1',
        originalUrl: 'https://example.com/x.jpg',
        imageUrl: 'https://blob.example/lgtm/x.webp',
        pHash: 'b'.repeat(1024),
        status: 'active',
        mimeType: 'image/webp',
        isAnimated: false,
      }),
    );
    expect(mocks.blob.del).not.toHaveBeenCalled();
  });

  it('アニメーション入力の場合 imageRepo.create に isAnimated:true が渡る (Issue #201)', async () => {
    const mocks = buildMocks();
    setupHappyPathMocks();
    composeLgtmImage.mockResolvedValue({
      buffer: Buffer.from('animated-webp'),
      width: 400,
      height: 300,
      byteLength: 13,
      isAnimated: true,
    });
    mocks.imageRepo.create.mockResolvedValue(buildImage({ isAnimated: true }));

    const service = await buildService(mocks);
    await service.createImage('user-1', 'https://example.com/x.gif');

    expect(mocks.imageRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        isAnimated: true,
        mimeType: 'image/webp',
      }),
    );
  });

  it('atomic increment が DailyLimitExceededError を throw した場合、DB は触らず新 Blob は del でロールバックする (TOCTOU レース敗北)', async () => {
    // Blob put は増分カウント前に走るため、TOCTOU 敗北時は del で孤児を回収する
    const mocks = buildMocks();
    setupHappyPathMocks();
    mocks.countRepo.getCount.mockResolvedValue(9);
    mocks.countRepo.increment.mockRejectedValue(new DailyLimitExceededError());

    const service = await buildService(mocks);
    await expect(service.createImage('user-1', 'https://example.com/x.jpg')).rejects.toBeInstanceOf(
      DailyLimitExceededError,
    );

    expect(mocks.blob.put).toHaveBeenCalled();
    expect(mocks.imageRepo.create).not.toHaveBeenCalled();
    expect(mocks.blob.del).toHaveBeenCalledWith('https://blob.example/lgtm/x.webp');
  });

  it('DB 登録に失敗したら Blob を del() でロールバックして例外を再 throw する', async () => {
    const mocks = buildMocks();
    setupHappyPathMocks();
    mocks.imageRepo.create.mockRejectedValue(new DatabaseError('insert failed'));

    const service = await buildService(mocks);

    await expect(service.createImage('user-1', 'https://example.com/x.jpg')).rejects.toBeInstanceOf(
      DatabaseError,
    );

    expect(mocks.countRepo.increment).toHaveBeenCalled();
    expect(mocks.blob.put).toHaveBeenCalled();
    expect(mocks.blob.del).toHaveBeenCalledWith('https://blob.example/lgtm/x.webp');
  });
});

describe('buildImageService', () => {
  it('Supabase Client から ImageService インスタンスを構築できる', async () => {
    const supabase = { from: () => ({}), rpc: () => ({}) } as unknown as SupabaseClient<Database>;
    const { buildImageService, ImageService } = await import('@/src/services/image-service');
    const service = buildImageService(supabase);
    expect(service).toBeInstanceOf(ImageService);
  });
});

describe('ImageService.listImages', () => {
  it('limit 未指定なら 16 件で repository を呼び、PublicLgtmImage に絞り込んで返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.list.mockResolvedValue([
      buildImage({ id: 'image-1', createdAt: new Date('2026-05-04T12:00:00.000Z') }),
      buildImage({ id: 'image-2', createdAt: new Date('2026-05-04T11:00:00.000Z') }),
    ]);

    const service = await buildService(mocks);
    const result = await service.listImages();

    expect(mocks.imageRepo.list).toHaveBeenCalledWith({ cursor: undefined, limit: 16 });
    expect(result.images).toEqual([
      {
        id: 'image-1',
        imageUrl: 'https://blob.example/lgtm/x.webp',
        uploaderId: 'user-1',
        width: 800,
        height: 600,
        isAnimated: false,
        createdAt: new Date('2026-05-04T12:00:00.000Z'),
      },
      {
        id: 'image-2',
        imageUrl: 'https://blob.example/lgtm/x.webp',
        uploaderId: 'user-1',
        width: 800,
        height: 600,
        isAnimated: false,
        createdAt: new Date('2026-05-04T11:00:00.000Z'),
      },
    ]);
    // limit (16) ちょうどでないので nextCursor は null
    expect(result.nextCursor).toBeNull();
  });

  it('返却件数 = limit のとき、末尾 createdAt の ISO 文字列を nextCursor に設定する', async () => {
    const mocks = buildMocks();
    const records = Array.from({ length: 3 }, (_, i) =>
      buildImage({
        id: `image-${i + 1}`,
        createdAt: new Date(Date.UTC(2026, 4, 4, 12, 0, i)),
      }),
    );
    mocks.imageRepo.list.mockResolvedValue(records);

    const service = await buildService(mocks);
    const result = await service.listImages({ limit: 3 });

    expect(mocks.imageRepo.list).toHaveBeenCalledWith({ cursor: undefined, limit: 3 });
    expect(result.images).toHaveLength(3);
    expect(result.nextCursor).toBe('2026-05-04T12:00:02.000Z');
  });

  it('返却件数 < limit のとき、nextCursor は null', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.list.mockResolvedValue([
      buildImage({ id: 'image-1', createdAt: new Date('2026-05-04T12:00:00.000Z') }),
    ]);

    const service = await buildService(mocks);
    const result = await service.listImages({ limit: 5 });

    expect(result.nextCursor).toBeNull();
  });

  it('cursor を渡すと repository.list へ伝播する', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.list.mockResolvedValue([]);

    const service = await buildService(mocks);
    await service.listImages({ cursor: '2026-05-04T11:00:00.000Z', limit: 10 });

    expect(mocks.imageRepo.list).toHaveBeenCalledWith({
      cursor: '2026-05-04T11:00:00.000Z',
      limit: 10,
    });
  });

  it('1 件もないとき空配列と null を返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.list.mockResolvedValue([]);

    const service = await buildService(mocks);
    const result = await service.listImages();

    expect(result.images).toEqual([]);
    expect(result.nextCursor).toBeNull();
  });
});

describe('ImageService.listRandomImages', () => {
  it('active が 0 件なら findManyActiveByIds を呼ばず空配列を返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue([]);

    const service = await buildService(mocks);
    const result = await service.listRandomImages();

    expect(result).toEqual({ images: [] });
    expect(mocks.imageRepo.findManyActiveByIds).not.toHaveBeenCalled();
  });

  it('limit 未指定なら LIST_IMAGES_DEFAULT_LIMIT 件に切り詰めて取得する', async () => {
    const mocks = buildMocks();
    const ids = Array.from({ length: 30 }, (_, i) => `id-${i}`);
    mocks.imageRepo.listActiveIds.mockResolvedValue(ids);
    mocks.imageRepo.findManyActiveByIds.mockResolvedValue([]);

    const service = await buildService(mocks);
    await service.listRandomImages();

    const sampled = mocks.imageRepo.findManyActiveByIds.mock.calls[0]?.[0] as string[];
    expect(sampled).toHaveLength(LIST_IMAGES_DEFAULT_LIMIT);
    // 抽出は母集団 (全 active id) の部分集合であること
    expect(sampled.every((id) => ids.includes(id))).toBe(true);
    expect(new Set(sampled).size).toBe(LIST_IMAGES_DEFAULT_LIMIT);
  });

  it('総件数が limit 以下なら全件を返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue(['a', 'b']);
    mocks.imageRepo.findManyActiveByIds.mockImplementation(async (ids: string[]) =>
      ids.map((id) => buildImage({ id })),
    );

    const service = await buildService(mocks);
    const result = await service.listRandomImages();

    expect(result.images).toHaveLength(2);
    expect(result.images.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('明示 limit で抽出件数を絞れる', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue(['a', 'b', 'c', 'd', 'e']);
    mocks.imageRepo.findManyActiveByIds.mockResolvedValue([]);

    const service = await buildService(mocks);
    await service.listRandomImages(2);

    const sampled = mocks.imageRepo.findManyActiveByIds.mock.calls[0]?.[0] as string[];
    expect(sampled).toHaveLength(2);
  });

  it('findManyActiveByIds の返却順に依らず、抽出 (シャッフル) 順で整列して返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue(['a', 'b', 'c']);
    // 要求した順 (sampled) と逆順で返しても、Service が sampled 順へ再整列する
    mocks.imageRepo.findManyActiveByIds.mockImplementation(async (ids: string[]) =>
      [...ids].reverse().map((id) => buildImage({ id })),
    );

    const service = await buildService(mocks);
    const result = await service.listRandomImages();

    const sampled = mocks.imageRepo.findManyActiveByIds.mock.calls[0]?.[0] as string[];
    expect(result.images.map((i) => i.id)).toEqual(sampled);
  });

  it('PublicLgtmImage に絞り込んで返す (pHash 等の内部フィールドを含まない)', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue(['a']);
    mocks.imageRepo.findManyActiveByIds.mockResolvedValue([
      buildImage({ id: 'a', width: 320, height: 240 }),
    ]);

    const service = await buildService(mocks);
    const result = await service.listRandomImages();

    expect(result.images[0]).toEqual({
      id: 'a',
      imageUrl: 'https://blob.example/lgtm/x.webp',
      uploaderId: 'user-1',
      width: 320,
      height: 240,
      isAnimated: false,
      createdAt: new Date('2026-05-04T12:00:00.000Z'),
    });
    expect(result).not.toHaveProperty('nextCursor');
  });

  it('抽出と取得の間に行が消えて一部 id が欠落しても、取得できた分だけ返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.listActiveIds.mockResolvedValue(['a', 'b']);
    // b は findManyActiveByIds の時点で active でなくなり返ってこない
    mocks.imageRepo.findManyActiveByIds.mockResolvedValue([buildImage({ id: 'a' })]);

    const service = await buildService(mocks);
    const result = await service.listRandomImages();

    expect(result.images.map((i) => i.id)).toEqual(['a']);
  });
});

describe('default BlobClient (@vercel/blob 委譲)', () => {
  it('blob を未注入で createImage を呼ぶと、@vercel/blob の put / del が利用される', async () => {
    const mocks = buildMocks();
    setupHappyPathMocks();
    blobPut.mockResolvedValue({ url: 'https://blob.example/lgtm/default.webp' });
    blobDel.mockResolvedValue(undefined);
    mocks.imageRepo.create.mockResolvedValueOnce(buildImage());

    const { ImageService } = await import('@/src/services/image-service');
    const service = new ImageService({
      imageRepo: mocks.imageRepo as unknown as ImageRepository,
      countRepo: mocks.countRepo as unknown as DailyUploadCountRepository,
      // blob 未注入 → defaultBlobClient
      clock: mocks.clock,
    });

    await service.createImage('user-1', 'https://example.com/x.jpg');

    expect(blobPut).toHaveBeenCalledWith(
      expect.stringMatching(/^lgtm\/[0-9a-f-]+\.webp$/),
      Buffer.from('webp'),
      {
        access: 'public',
        contentType: 'image/webp',
        cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE_SECONDS,
      },
    );
  });

  it('blob 未注入で DB 登録失敗時は @vercel/blob の del が呼ばれる (rollback)', async () => {
    const mocks = buildMocks();
    setupHappyPathMocks();
    blobPut.mockResolvedValue({ url: 'https://blob.example/lgtm/default.webp' });
    blobDel.mockResolvedValue(undefined);
    mocks.imageRepo.create.mockRejectedValueOnce(new DatabaseError('insert failed'));

    const { ImageService } = await import('@/src/services/image-service');
    const service = new ImageService({
      imageRepo: mocks.imageRepo as unknown as ImageRepository,
      countRepo: mocks.countRepo as unknown as DailyUploadCountRepository,
      clock: mocks.clock,
    });

    await expect(service.createImage('user-1', 'https://example.com/x.jpg')).rejects.toBeInstanceOf(
      DatabaseError,
    );

    expect(blobDel).toHaveBeenCalledWith('https://blob.example/lgtm/default.webp');
  });
});

describe('ImageService.getImageDetail', () => {
  it('Repository が LgtmImage を返したら originalUrl 込みの PublicLgtmImageDetail に整形して返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(
      buildImage({
        id: 'image-42',
        width: 1024,
        height: 768,
        originalUrl: 'https://example.com/detail-source.jpg',
      }),
    );

    const service = await buildService(mocks);
    const result = await service.getImageDetail('image-42');

    expect(mocks.imageRepo.findActiveById).toHaveBeenCalledWith('image-42');
    expect(result).toEqual({
      id: 'image-42',
      imageUrl: 'https://blob.example/lgtm/x.webp',
      uploaderId: 'user-1',
      width: 1024,
      height: 768,
      isAnimated: false,
      createdAt: new Date('2026-05-04T12:00:00.000Z'),
      originalUrl: 'https://example.com/detail-source.jpg',
    });
  });

  it('Repository が null を返したら null を返す', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(null);

    const service = await buildService(mocks);
    expect(await service.getImageDetail('missing')).toBeNull();
  });

  it('Repository が throw したらそのまま伝播する (Page 側で notFound() に変換する責務)', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockRejectedValue(new DatabaseError('boom'));

    const service = await buildService(mocks);
    await expect(service.getImageDetail('image-1')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('ImageService.deleteImage', () => {
  it('画像が存在しない (findActiveById = null) なら NotFoundError を throw し softDelete は呼ばない', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(null);

    const service = await buildService(mocks);
    await expect(service.deleteImage('image-1', 'user-1')).rejects.toBeInstanceOf(NotFoundError);

    expect(mocks.imageRepo.softDelete).not.toHaveBeenCalled();
  });

  it('uploaderId が requesterId と異なれば ForbiddenError を throw し softDelete は呼ばない', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(buildImage({ uploaderId: 'user-1' }));

    const service = await buildService(mocks);
    await expect(service.deleteImage('image-1', 'user-2')).rejects.toBeInstanceOf(ForbiddenError);

    expect(mocks.imageRepo.softDelete).not.toHaveBeenCalled();
  });

  it('正常系: findActiveById で所有者一致 → softDelete=1 で resolve する', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(buildImage({ uploaderId: 'user-1' }));
    mocks.imageRepo.softDelete.mockResolvedValue(1);

    const service = await buildService(mocks);
    await expect(service.deleteImage('image-1', 'user-1')).resolves.toBeUndefined();

    expect(mocks.imageRepo.softDelete).toHaveBeenCalledWith('image-1', 'user-1');
  });

  it('TOCTOU: findActiveById 後に削除されて softDelete=0 なら NotFoundError', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(buildImage({ uploaderId: 'user-1' }));
    mocks.imageRepo.softDelete.mockResolvedValue(0);

    const service = await buildService(mocks);
    await expect(service.deleteImage('image-1', 'user-1')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('ImageService.regenerateImage', () => {
  function setupRegenerateHappyPath(mocks: Mocks) {
    setupHappyPathMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(
      buildImage({
        id: 'image-1',
        originalUrl: 'https://example.com/original.jpg',
        imageUrl: 'https://blob.example/lgtm/old.webp',
      }),
    );
    mocks.blob.put.mockResolvedValue({ url: 'https://blob.example/lgtm/new.webp' });
    mocks.imageRepo.updateAfterRegenerate.mockResolvedValue(
      buildImage({
        id: 'image-1',
        imageUrl: 'https://blob.example/lgtm/new.webp',
      }),
    );
  }

  it('対象画像が存在しなければ NotFoundError を throw し、以降の処理は一切走らない', async () => {
    const mocks = buildMocks();
    mocks.imageRepo.findActiveById.mockResolvedValue(null);

    const service = await buildService(mocks);
    await expect(service.regenerateImage('image-missing', undefined)).rejects.toBeInstanceOf(
      NotFoundError,
    );

    expect(safeFetch).not.toHaveBeenCalled();
    expect(mocks.blob.put).not.toHaveBeenCalled();
    expect(mocks.imageRepo.updateAfterRegenerate).not.toHaveBeenCalled();
    expect(mocks.blob.del).not.toHaveBeenCalled();
  });

  it('overrideOriginalUrl 未指定なら既存の originalUrl から再取得する (差し替えなし)', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const service = await buildService(mocks);
    const result = await service.regenerateImage('image-1', undefined);

    expect(safeFetch).toHaveBeenCalledWith('https://example.com/original.jpg');
    // originalUrl は据え置き (Repository には渡さない)
    expect(mocks.imageRepo.updateAfterRegenerate).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({
        imageUrl: 'https://blob.example/lgtm/new.webp',
        pHash: 'b'.repeat(1024),
      }),
    );
    const patch = mocks.imageRepo.updateAfterRegenerate.mock.calls[0]?.[1] as {
      originalUrl?: string;
    };
    expect(patch.originalUrl).toBeUndefined();
    expect(result.urlChanged).toBe(false);
    expect(result.previousImageUrl).toBe('https://blob.example/lgtm/old.webp');
  });

  it('overrideOriginalUrl 指定 (差し替え) なら新 URL で取得し、Repository に originalUrl を渡す', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const service = await buildService(mocks);
    const result = await service.regenerateImage('image-1', 'https://example.com/replaced.jpg');

    expect(safeFetch).toHaveBeenCalledWith('https://example.com/replaced.jpg');
    expect(mocks.imageRepo.updateAfterRegenerate).toHaveBeenCalledWith(
      'image-1',
      expect.objectContaining({
        originalUrl: 'https://example.com/replaced.jpg',
      }),
    );
    expect(result.urlChanged).toBe(true);
  });

  it('overrideOriginalUrl が既存 originalUrl と同一なら urlChanged=false になる', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const service = await buildService(mocks);
    const result = await service.regenerateImage('image-1', 'https://example.com/original.jpg');

    expect(result.urlChanged).toBe(false);
  });

  it('重複判定は自レコード ID を除外する (listActivePHashesExcept を呼ぶ)', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const service = await buildService(mocks);
    await service.regenerateImage('image-1', undefined);

    expect(mocks.imageRepo.listActivePHashesExcept).toHaveBeenCalledWith('image-1');
    expect(mocks.imageRepo.listActivePHashes).not.toHaveBeenCalled();
  });

  it('日次アップロードカウントは加算しない (既存の作り直しのため)', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const service = await buildService(mocks);
    await service.regenerateImage('image-1', undefined);

    expect(mocks.countRepo.increment).not.toHaveBeenCalled();
    expect(mocks.countRepo.getCount).not.toHaveBeenCalled();
  });

  it('別の active 画像と pHash が重複したら DuplicateImageError を throw し、Blob put / DB update は呼ばれない', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);
    mocks.imageRepo.listActivePHashesExcept.mockResolvedValue([
      { id: 'other-1', pHash: 'a'.repeat(1024) },
    ]);
    calculatePHash.mockResolvedValue('a'.repeat(1024));
    isDuplicate.mockReturnValueOnce(true);

    const service = await buildService(mocks);
    await expect(service.regenerateImage('image-1', undefined)).rejects.toBeInstanceOf(
      DuplicateImageError,
    );

    expect(mocks.blob.put).not.toHaveBeenCalled();
    expect(mocks.imageRepo.updateAfterRegenerate).not.toHaveBeenCalled();
    expect(mocks.blob.del).not.toHaveBeenCalled();
  });

  it('取得 / 検証失敗時は既存レコード・Blob に一切触れない', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);
    safeFetch.mockRejectedValue(new Error('fetch failed'));

    const service = await buildService(mocks);
    await expect(service.regenerateImage('image-1', undefined)).rejects.toThrow('fetch failed');

    expect(mocks.blob.put).not.toHaveBeenCalled();
    expect(mocks.imageRepo.updateAfterRegenerate).not.toHaveBeenCalled();
    expect(mocks.blob.del).not.toHaveBeenCalled();
  });

  it('正常系: 新 Blob に put → DB update → 旧 Blob を best-effort で del の順で実行する', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);

    const callOrder: string[] = [];
    mocks.blob.put.mockImplementation(async () => {
      callOrder.push('blob.put');
      return { url: 'https://blob.example/lgtm/new.webp' };
    });
    mocks.imageRepo.updateAfterRegenerate.mockImplementation(async () => {
      callOrder.push('updateAfterRegenerate');
      return buildImage({ id: 'image-1', imageUrl: 'https://blob.example/lgtm/new.webp' });
    });
    mocks.blob.del.mockImplementation(async (url: string) => {
      callOrder.push(`blob.del:${url}`);
    });

    const service = await buildService(mocks);
    const result = await service.regenerateImage('image-1', undefined);

    expect(callOrder).toEqual([
      'blob.put',
      'updateAfterRegenerate',
      'blob.del:https://blob.example/lgtm/old.webp',
    ]);
    expect(result.image.imageUrl).toBe('https://blob.example/lgtm/new.webp');
  });

  it('DB 更新失敗時は新 Blob を del してロールバックし、旧 Blob は触らない', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);
    mocks.imageRepo.updateAfterRegenerate.mockRejectedValue(new DatabaseError('update failed'));

    const service = await buildService(mocks);
    await expect(service.regenerateImage('image-1', undefined)).rejects.toBeInstanceOf(
      DatabaseError,
    );

    expect(mocks.blob.del).toHaveBeenCalledTimes(1);
    expect(mocks.blob.del).toHaveBeenCalledWith('https://blob.example/lgtm/new.webp');
  });

  it('旧 Blob 削除失敗はログ warning のみで、再生成成功として resolve する (best-effort)', async () => {
    const mocks = buildMocks();
    setupRegenerateHappyPath(mocks);
    mocks.blob.del.mockRejectedValue(new Error('blob del failed'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const service = await buildService(mocks);
    const result = await service.regenerateImage('image-1', undefined);

    expect(result.image.imageUrl).toBe('https://blob.example/lgtm/new.webp');
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
