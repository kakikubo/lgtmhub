import { describe, expect, it } from 'vitest';
import {
  imageSearchQuerySchema,
  imageSearchResponseSchema,
  imageSearchResultSchema,
} from '@/src/lib/validation/image-search';

describe('imageSearchQuerySchema', () => {
  it('正常: q のみ受け付ける', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'cat' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe('cat');
      expect(result.data.page).toBeUndefined();
    }
  });

  it('正常: page を coerce する', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'cat', page: '3' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(3);
    }
  });

  it('正常: 前後の空白を trim する', () => {
    const result = imageSearchQuerySchema.safeParse({ q: '  cat  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.q).toBe('cat');
    }
  });

  it('異常: 空文字は弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: '' });
    expect(result.success).toBe(false);
  });

  it('異常: trim 後の空文字も弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: '   ' });
    expect(result.success).toBe(false);
  });

  it('異常: 100 文字を超えるキーワードは弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'a'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('異常: page=0 は弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'cat', page: '0' });
    expect(result.success).toBe(false);
  });

  it('異常: page が整数でない場合は弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'cat', page: '1.5' });
    expect(result.success).toBe(false);
  });

  it('異常: page が上限超えなら弾く', () => {
    const result = imageSearchQuerySchema.safeParse({ q: 'cat', page: '999' });
    expect(result.success).toBe(false);
  });
});

describe('imageSearchResultSchema', () => {
  const valid = {
    id: 'pexels:1',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    imageUrl: 'https://example.com/image.jpg',
    width: 100,
    height: 200,
    alt: 'a cat',
    provider: 'pexels' as const,
    attribution: {
      photographer: 'Foo',
      photographerUrl: 'https://example.com/foo',
      sourceUrl: 'https://example.com/source',
    },
  };

  it('正常な値はそのまま通る', () => {
    expect(imageSearchResultSchema.safeParse(valid).success).toBe(true);
  });

  it('未対応プロバイダーは弾く', () => {
    expect(imageSearchResultSchema.safeParse({ ...valid, provider: 'unsplash' }).success).toBe(
      false,
    );
  });

  it('width が 0 以下なら弾く', () => {
    expect(imageSearchResultSchema.safeParse({ ...valid, width: 0 }).success).toBe(false);
  });

  it('photographer が空文字なら弾く', () => {
    expect(
      imageSearchResultSchema.safeParse({
        ...valid,
        attribution: { ...valid.attribution, photographer: '' },
      }).success,
    ).toBe(false);
  });
});

describe('imageSearchResponseSchema', () => {
  it('正常: results 空配列でも通る', () => {
    const result = imageSearchResponseSchema.safeParse({
      results: [],
      page: 1,
      hasNextPage: false,
      provider: 'pexels',
    });
    expect(result.success).toBe(true);
  });

  it('異常: page が 0 以下', () => {
    const result = imageSearchResponseSchema.safeParse({
      results: [],
      page: 0,
      hasNextPage: false,
      provider: 'pexels',
    });
    expect(result.success).toBe(false);
  });
});
