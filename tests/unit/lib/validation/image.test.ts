import { describe, expect, it } from 'vitest';
import {
  createImageErrorResponseSchema,
  createImageRequestSchema,
  createImageResponseSchema,
  LIST_IMAGES_DEFAULT_LIMIT,
  LIST_IMAGES_MAX_LIMIT,
  listImagesQuerySchema,
  listImagesResponseSchema,
} from '@/src/lib/validation/image';

describe('createImageRequestSchema', () => {
  it('HTTPS の URL を受理する', () => {
    const result = createImageRequestSchema.safeParse({ imageUrl: 'https://example.com/cat.jpg' });
    expect(result.success).toBe(true);
  });

  it('HTTP の URL を拒否する', () => {
    const result = createImageRequestSchema.safeParse({ imageUrl: 'http://example.com/cat.jpg' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('HTTPS');
    }
  });

  it('URL でない値を拒否する', () => {
    const result = createImageRequestSchema.safeParse({ imageUrl: 'not a url' });
    expect(result.success).toBe(false);
  });

  it('空文字を拒否する', () => {
    const result = createImageRequestSchema.safeParse({ imageUrl: '' });
    expect(result.success).toBe(false);
  });

  it('2048 文字を超える URL を拒否する', () => {
    const longTail = 'a'.repeat(2048);
    const result = createImageRequestSchema.safeParse({
      imageUrl: `https://example.com/${longTail}`,
    });
    expect(result.success).toBe(false);
  });

  it('imageUrl が欠けている場合を拒否する', () => {
    const result = createImageRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('listImagesQuerySchema', () => {
  it('デフォルト定数が想定値である', () => {
    expect(LIST_IMAGES_DEFAULT_LIMIT).toBe(16);
    expect(LIST_IMAGES_MAX_LIMIT).toBe(50);
  });

  it('cursor / limit がいずれも未指定でも成功する', () => {
    const result = listImagesQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
      expect(result.data.limit).toBeUndefined();
    }
  });

  it('正しい ISO 8601 の cursor を受理する', () => {
    const result = listImagesQuerySchema.safeParse({ cursor: '2026-05-04T12:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('ISO 8601 でない cursor を拒否する', () => {
    const result = listImagesQuerySchema.safeParse({ cursor: '2026-05-04 12:00' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('ISO 8601');
    }
  });

  it('limit を文字列で渡しても数値に強制変換する', () => {
    const result = listImagesQuerySchema.safeParse({ limit: '10' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(10);
    }
  });

  it('limit = 1 と limit = 50 を受理する (境界値)', () => {
    expect(listImagesQuerySchema.safeParse({ limit: 1 }).success).toBe(true);
    expect(listImagesQuerySchema.safeParse({ limit: 50 }).success).toBe(true);
  });

  it('limit = 0 を拒否する', () => {
    const result = listImagesQuerySchema.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it('limit = 51 を拒否する', () => {
    const result = listImagesQuerySchema.safeParse({ limit: 51 });
    expect(result.success).toBe(false);
  });

  it('limit が小数 (1.5) なら拒否する', () => {
    const result = listImagesQuerySchema.safeParse({ limit: 1.5 });
    expect(result.success).toBe(false);
  });

  it('limit が数値変換できない値なら拒否する', () => {
    const result = listImagesQuerySchema.safeParse({ limit: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('listImagesResponseSchema', () => {
  it('正しいレスポンス形式を受理する', () => {
    const result = listImagesResponseSchema.safeParse({
      images: [
        {
          id: 'image-1',
          imageUrl: 'https://blob.example/lgtm/x.webp',
          uploaderId: 'user-1',
          width: 800,
          height: 600,
          createdAt: '2026-05-04T12:00:00.000Z',
        },
      ],
      nextCursor: '2026-05-04T11:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('width / height が欠けていれば拒否する', () => {
    const result = listImagesResponseSchema.safeParse({
      images: [
        {
          id: 'image-1',
          imageUrl: 'https://blob.example/lgtm/x.webp',
          uploaderId: 'user-1',
          createdAt: '2026-05-04T12:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
    expect(result.success).toBe(false);
  });

  it('nextCursor は null でも良い', () => {
    const result = listImagesResponseSchema.safeParse({ images: [], nextCursor: null });
    expect(result.success).toBe(true);
  });

  it('images が配列でなければ拒否する', () => {
    const result = listImagesResponseSchema.safeParse({ images: 'oops', nextCursor: null });
    expect(result.success).toBe(false);
  });

  it('image の必須フィールドが欠けていれば拒否する', () => {
    const result = listImagesResponseSchema.safeParse({
      images: [{ id: 'x', imageUrl: 'https://blob.example/x.webp' }],
      nextCursor: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('createImageResponseSchema', () => {
  it('id と imageUrl が揃っていれば受理する', () => {
    const result = createImageResponseSchema.safeParse({
      id: 'image-1',
      imageUrl: 'https://blob.example/lgtm/x.webp',
    });
    expect(result.success).toBe(true);
  });

  it('id が欠けていれば拒否する', () => {
    const result = createImageResponseSchema.safeParse({
      imageUrl: 'https://blob.example/lgtm/x.webp',
    });
    expect(result.success).toBe(false);
  });

  it('imageUrl が URL 形式でなければ拒否する', () => {
    const result = createImageResponseSchema.safeParse({
      id: 'image-1',
      imageUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('id が空文字なら拒否する', () => {
    const result = createImageResponseSchema.safeParse({
      id: '',
      imageUrl: 'https://blob.example/lgtm/x.webp',
    });
    expect(result.success).toBe(false);
  });
});

describe('createImageErrorResponseSchema', () => {
  it('error のみのレスポンスを受理する', () => {
    const result = createImageErrorResponseSchema.safeParse({ error: '入力値が不正です' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.existingImageId).toBeUndefined();
    }
  });

  it('409 形式 (error + existingImageId) を受理する', () => {
    const result = createImageErrorResponseSchema.safeParse({
      error: '同じ画像がすでに登録されています',
      existingImageId: 'image-1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.existingImageId).toBe('image-1');
    }
  });

  it('error が欠けていれば拒否する', () => {
    const result = createImageErrorResponseSchema.safeParse({ existingImageId: 'image-1' });
    expect(result.success).toBe(false);
  });

  it('error が空文字なら拒否する', () => {
    const result = createImageErrorResponseSchema.safeParse({ error: '' });
    expect(result.success).toBe(false);
  });
});
