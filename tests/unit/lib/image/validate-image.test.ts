import sharp, { type Metadata } from 'sharp';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@/src/lib/errors';
import { assertSupportedImageMetadata, validateImage } from '@/src/lib/image/validate-image';

async function makeBuffer(format: 'jpeg' | 'png' | 'webp' | 'gif'): Promise<Buffer> {
  const base = sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 100, g: 150, b: 200 } },
  });
  switch (format) {
    case 'jpeg':
      return base.jpeg().toBuffer();
    case 'png':
      return base.png().toBuffer();
    case 'webp':
      return base.webp().toBuffer();
    case 'gif':
      return base.gif().toBuffer();
  }
}

function fakeMetadata(overrides: Partial<Metadata>): Metadata {
  // 必要最小限の項目のみ持つ Metadata を構築 (テストでの分岐検証用)
  return overrides as Metadata;
}

describe('validateImage (実 sharp 経由)', () => {
  it('JPEG を受理する', async () => {
    const buffer = await makeBuffer('jpeg');
    await expect(validateImage(buffer)).resolves.toEqual({
      format: 'jpeg',
      width: 64,
      height: 64,
    });
  });

  it('PNG を受理する', async () => {
    const buffer = await makeBuffer('png');
    const result = await validateImage(buffer);
    expect(result.format).toBe('png');
  });

  it('静止画 GIF を受理する', async () => {
    const buffer = await makeBuffer('gif');
    const result = await validateImage(buffer);
    expect(result.format).toBe('gif');
  });

  it('WebP を拒否する (BadRequestError)', async () => {
    const buffer = await makeBuffer('webp');
    await expect(validateImage(buffer)).rejects.toBeInstanceOf(BadRequestError);
  });

  it('破損した画像を拒否する', async () => {
    await expect(validateImage(Buffer.from('garbage'))).rejects.toBeInstanceOf(BadRequestError);
  });
});

describe('assertSupportedImageMetadata', () => {
  it('対応外フォーマットを拒否する', () => {
    expect(() =>
      assertSupportedImageMetadata(fakeMetadata({ format: 'tiff', width: 100, height: 100 })),
    ).toThrow('JPEG');
  });

  it('アニメーション GIF (pages > 1) を拒否する', () => {
    expect(() =>
      assertSupportedImageMetadata(
        fakeMetadata({ format: 'gif', width: 50, height: 50, pages: 3 }),
      ),
    ).toThrow('アニメーション');
  });

  it('width / height が判定不能な場合を拒否する', () => {
    expect(() => assertSupportedImageMetadata(fakeMetadata({ format: 'png' }))).toThrow(
      'サイズを判定',
    );
  });

  it('正常な静止画 GIF metadata を受理する', () => {
    expect(
      assertSupportedImageMetadata(
        fakeMetadata({ format: 'gif', width: 50, height: 50, pages: 1 }),
      ),
    ).toEqual({ format: 'gif', width: 50, height: 50 });
  });
});
