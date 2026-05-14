import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { composeLgtmImage, MAX_LONG_SIDE } from '@/src/lib/image/compose-lgtm';

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
  it('出力は WebP 形式で、長辺が MAX_LONG_SIDE になる (横長 1920×1080 → 400×225)', async () => {
    const input = await makeImage(1920, 1080);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(MAX_LONG_SIDE);
    expect(result.height).toBe(225);
    expect(result.byteLength).toBeGreaterThan(0);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(MAX_LONG_SIDE);
    expect(meta.height).toBe(225);
  });

  it.each([
    { label: '横長', width: 1920, height: 1080, expectedW: 400, expectedH: 225 },
    { label: '4:3 横長', width: 1200, height: 900, expectedW: 400, expectedH: 300 },
    { label: '正方形', width: 1024, height: 1024, expectedW: 400, expectedH: 400 },
    { label: '縦長', width: 736, height: 1000, expectedW: 294, expectedH: 400 },
    { label: '縦長 (短辺切り捨て)', width: 600, height: 1000, expectedW: 240, expectedH: 400 },
  ])('アスペクト比違い ($label) でも長辺が $expectedW × $expectedH (長辺 400) になる', async ({
    width,
    height,
    expectedW,
    expectedH,
  }) => {
    const input = await makeImage(width, height);
    const result = await composeLgtmImage(input);

    expect(Math.max(result.width, result.height)).toBe(MAX_LONG_SIDE);
    expect(result.width).toBe(expectedW);
    expect(result.height).toBe(expectedH);
  });

  it('原画が MAX_LONG_SIDE 未満の場合は拡大されず原画サイズで保存される (300×200 → 300×200)', async () => {
    const input = await makeImage(300, 200);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
  });

  it('原画長辺がちょうど MAX_LONG_SIDE のときは元サイズが維持される (400×300 → 400×300)', async () => {
    const input = await makeImage(400, 300);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
  });

  it('破損した入力は BadRequestError を throw する', async () => {
    await expect(composeLgtmImage(Buffer.from('not an image'))).rejects.toThrow();
  });

  it('合成に使用するフォントファイル (Archivo Black) が同梱されている', () => {
    const fontDir = path.join(process.cwd(), 'public/fonts');
    expect(existsSync(path.join(fontDir, 'ArchivoBlack-Regular.ttf'))).toBe(true);
    expect(existsSync(path.join(fontDir, 'Roboto-Black.ttf'))).toBe(false);
  });
});
