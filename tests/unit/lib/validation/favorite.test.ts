import { describe, expect, it } from 'vitest';
import {
  createFavoriteRequestSchema,
  createFavoriteResponseSchema,
  favoriteImageIdParamSchema,
  favoriteImageIdsResponseSchema,
  LIST_FAVORITES_DEFAULT_LIMIT,
  LIST_FAVORITES_MAX_LIMIT,
  listFavoritesQuerySchema,
  listFavoritesResponseSchema,
} from '@/src/lib/validation/favorite';

const UUID = '11111111-2222-4333-8444-555555555555';

describe('createFavoriteRequestSchema', () => {
  it('UUID の lgtmImageId を受理する', () => {
    const result = createFavoriteRequestSchema.safeParse({ lgtmImageId: UUID });
    expect(result.success).toBe(true);
  });

  it('UUID でない値を拒否する', () => {
    const result = createFavoriteRequestSchema.safeParse({ lgtmImageId: 'not-a-uuid' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('画像 ID が不正です');
    }
  });

  it('lgtmImageId が欠けている場合は拒否する', () => {
    expect(createFavoriteRequestSchema.safeParse({}).success).toBe(false);
  });

  it('body が null の場合は拒否する', () => {
    expect(createFavoriteRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe('favoriteImageIdParamSchema', () => {
  it('UUID のパスパラメータを受理する', () => {
    expect(favoriteImageIdParamSchema.safeParse({ lgtmImageId: UUID }).success).toBe(true);
  });

  it('UUID でないパスパラメータを拒否する', () => {
    expect(favoriteImageIdParamSchema.safeParse({ lgtmImageId: '123' }).success).toBe(false);
  });
});

describe('listFavoritesQuerySchema', () => {
  it('cursor / limit 未指定を受理する', () => {
    const result = listFavoritesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
      expect(result.data.limit).toBeUndefined();
    }
  });

  it('ISO 8601 の cursor を受理する', () => {
    const result = listFavoritesQuerySchema.safeParse({ cursor: '2026-08-20T00:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('ISO 8601 でない cursor を拒否する', () => {
    const result = listFavoritesQuerySchema.safeParse({ cursor: '2026/08/20' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('ISO 8601');
    }
  });

  it('limit を数値へ coerce する', () => {
    const result = listFavoritesQuerySchema.safeParse({ limit: '30' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(30);
    }
  });

  it('limit の上限を超える値を拒否する', () => {
    const result = listFavoritesQuerySchema.safeParse({ limit: LIST_FAVORITES_MAX_LIMIT + 1 });
    expect(result.success).toBe(false);
  });

  it('limit が 0 以下の値を拒否する', () => {
    expect(listFavoritesQuerySchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('limit が整数でない値を拒否する', () => {
    expect(listFavoritesQuerySchema.safeParse({ limit: 1.5 }).success).toBe(false);
  });

  it('既定値と上限は functional-design.md の仕様 (20 / 50) と一致する', () => {
    expect(LIST_FAVORITES_DEFAULT_LIMIT).toBe(20);
    expect(LIST_FAVORITES_MAX_LIMIT).toBe(50);
  });
});

describe('レスポンススキーマ', () => {
  it('createFavoriteResponseSchema は id / lgtmImageId を要求する', () => {
    expect(createFavoriteResponseSchema.safeParse({ id: 'fav-1', lgtmImageId: UUID }).success).toBe(
      true,
    );
    expect(createFavoriteResponseSchema.safeParse({ id: '', lgtmImageId: UUID }).success).toBe(
      false,
    );
  });

  it('listFavoritesResponseSchema は画像一覧と同じ形を受理する', () => {
    const result = listFavoritesResponseSchema.safeParse({
      images: [
        {
          id: 'img-1',
          imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
          uploaderId: 'user-1',
          width: 266,
          height: 199,
          isAnimated: false,
          createdAt: '2026-08-20T00:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    expect(result.success).toBe(true);
  });

  it('listFavoritesResponseSchema は nextCursor 欠落を拒否する', () => {
    expect(listFavoritesResponseSchema.safeParse({ images: [] }).success).toBe(false);
  });

  it('favoriteImageIdsResponseSchema は文字列配列を受理する', () => {
    expect(favoriteImageIdsResponseSchema.safeParse({ lgtmImageIds: ['a', 'b'] }).success).toBe(
      true,
    );
    expect(favoriteImageIdsResponseSchema.safeParse({ lgtmImageIds: [1] }).success).toBe(false);
  });
});
