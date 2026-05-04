import { describe, expect, it } from 'vitest';
import { createImageRequestSchema } from '@/src/lib/validation/image';

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
    const result = createImageRequestSchema.safeParse({ imageUrl: `https://example.com/${longTail}` });
    expect(result.success).toBe(false);
  });

  it('imageUrl が欠けている場合を拒否する', () => {
    const result = createImageRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
