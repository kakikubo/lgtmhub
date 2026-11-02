import sharp, { type Metadata } from 'sharp';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@/src/lib/errors';
import {
  assertSupportedImageMetadata,
  MAX_GIF_FRAMES,
  validateImage,
} from '@/src/lib/image/validate-image';

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

async function makeAnimatedGif(frameCount: number): Promise<Buffer> {
  // sharp で純粋にアニメ GIF を生成するには「縦タイル + pageHeight 指定 + animated」が必要。
  // RGB 3 ch すべてをフレームごとに変化させて隣接フレームの dedup を回避する
  // (sharp の GIF エンコーダは同一フレームをマージするため pages が n より少なくなる)。
  const frameWidth = 16;
  const frameHeight = 16;
  const channels = 3;
  const stripe = Buffer.alloc(frameWidth * frameHeight * frameCount * channels);
  for (let i = 0; i < frameCount; i++) {
    for (let p = 0; p < frameWidth * frameHeight; p++) {
      const offset = (i * frameWidth * frameHeight + p) * channels;
      stripe[offset] = (i * 7) % 250;
      stripe[offset + 1] = (i * 3) % 200;
      stripe[offset + 2] = (i * 5) % 240;
    }
  }
  const delays = new Array(frameCount).fill(100);
  return sharp(stripe, {
    raw: { width: frameWidth, height: frameHeight * frameCount, channels, pageHeight: frameHeight },
  })
    .gif({ loop: 0, delay: delays })
    .toBuffer();
}

async function makeAnimatedWebp(frameCount: number): Promise<Buffer> {
  // アニメ WebP も「縦タイル + pageHeight + animated 入力」で生成する。
  // WebP エンコーダも GIF 同様、同一フレームを deduplicate するため
  // RGB を毎フレーム変化させて pages が想定どおりになるよう担保する。
  const frameWidth = 16;
  const frameHeight = 16;
  const channels = 3;
  const stripe = Buffer.alloc(frameWidth * frameHeight * frameCount * channels);
  for (let i = 0; i < frameCount; i++) {
    for (let p = 0; p < frameWidth * frameHeight; p++) {
      const offset = (i * frameWidth * frameHeight + p) * channels;
      stripe[offset] = (i * 7) % 250;
      stripe[offset + 1] = (i * 3) % 200;
      stripe[offset + 2] = (i * 5) % 240;
    }
  }
  const delays = new Array(frameCount).fill(100);
  return sharp(stripe, {
    raw: { width: frameWidth, height: frameHeight * frameCount, channels, pageHeight: frameHeight },
  })
    .webp({ loop: 0, delay: delays })
    .toBuffer();
}

function fakeMetadata(overrides: Partial<Metadata>): Metadata {
  // 必要最小限の項目のみ持つ Metadata を構築 (テストでの分岐検証用)
  return overrides as Metadata;
}

describe('validateImage (実 sharp 経由)', () => {
  it('JPEG を受理し pages=1 を返す', async () => {
    const buffer = await makeBuffer('jpeg');
    await expect(validateImage(buffer)).resolves.toEqual({
      format: 'jpeg',
      width: 64,
      height: 64,
      pages: 1,
    });
  });

  it('PNG を受理する', async () => {
    const buffer = await makeBuffer('png');
    const result = await validateImage(buffer);
    expect(result.format).toBe('png');
    expect(result.pages).toBe(1);
  });

  it('静止画 GIF を受理し pages=1 を返す', async () => {
    const buffer = await makeBuffer('gif');
    const result = await validateImage(buffer);
    expect(result.format).toBe('gif');
    expect(result.pages).toBe(1);
  });

  it('アニメーション GIF を受理し pages=N を返す (Issue #201)', async () => {
    const buffer = await makeAnimatedGif(5);
    const result = await validateImage(buffer);
    expect(result.format).toBe('gif');
    expect(result.pages).toBe(5);
  });

  it('静止 WebP を受理し pages=1 を返す (Issue #213)', async () => {
    const buffer = await makeBuffer('webp');
    const result = await validateImage(buffer);
    expect(result.format).toBe('webp');
    expect(result.pages).toBe(1);
  });

  it('アニメーション WebP を受理し pages=N を返す (Issue #213)', async () => {
    const buffer = await makeAnimatedWebp(4);
    const result = await validateImage(buffer);
    expect(result.format).toBe('webp');
    expect(result.pages).toBe(4);
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

  it(`フレーム数が ${MAX_GIF_FRAMES} を超える場合は BadRequestError`, () => {
    expect(() =>
      assertSupportedImageMetadata(
        fakeMetadata({ format: 'gif', width: 50, height: 50, pages: MAX_GIF_FRAMES + 1 }),
      ),
    ).toThrow('フレーム数が多すぎます');
  });

  it(`フレーム数がちょうど ${MAX_GIF_FRAMES} の場合は受理する`, () => {
    expect(
      assertSupportedImageMetadata(
        fakeMetadata({ format: 'gif', width: 50, height: 50, pages: MAX_GIF_FRAMES }),
      ),
    ).toEqual({ format: 'gif', width: 50, height: 50, pages: MAX_GIF_FRAMES });
  });

  it('width / height が判定不能な場合を拒否する', () => {
    expect(() => assertSupportedImageMetadata(fakeMetadata({ format: 'png' }))).toThrow(
      'サイズを判定',
    );
  });

  it('正常な静止画 GIF metadata を受理し pages=1 を返す', () => {
    expect(
      assertSupportedImageMetadata(
        fakeMetadata({ format: 'gif', width: 50, height: 50, pages: 1 }),
      ),
    ).toEqual({ format: 'gif', width: 50, height: 50, pages: 1 });
  });

  it('pages 未指定 (jpeg / png) は pages=1 として受理する', () => {
    expect(
      assertSupportedImageMetadata(fakeMetadata({ format: 'png', width: 50, height: 50 })),
    ).toEqual({ format: 'png', width: 50, height: 50, pages: 1 });
  });
});
