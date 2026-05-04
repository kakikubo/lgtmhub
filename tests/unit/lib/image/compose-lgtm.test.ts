import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { MAX_OUTPUT_WIDTH, composeLgtmImage } from '@/src/lib/image/compose-lgtm';

async function makeImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 100, b: 50 },
    },
  })
    .png()
    .toBuffer();
}

describe('composeLgtmImage', () => {
  it('出力は WebP 形式で、幅は元画像と同じ (1200 以下)', async () => {
    const input = await makeImage(800, 600);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(800);
    expect(result.height).toBe(600);
    expect(result.byteLength).toBeGreaterThan(0);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(800);
    expect(meta.height).toBe(600);
  });

  it('元画像が 1200 を超える場合は MAX_OUTPUT_WIDTH に縮小される', async () => {
    const input = await makeImage(2400, 1200);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(MAX_OUTPUT_WIDTH);
    expect(result.height).toBe(600);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.width).toBe(MAX_OUTPUT_WIDTH);
    expect(meta.height).toBe(600);
  });

  it('小さい画像は拡大されず元のサイズで返される', async () => {
    const input = await makeImage(100, 80);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
  });

  it('破損した入力は BadRequestError を throw する', async () => {
    await expect(composeLgtmImage(Buffer.from('not an image'))).rejects.toThrow();
  });
});
