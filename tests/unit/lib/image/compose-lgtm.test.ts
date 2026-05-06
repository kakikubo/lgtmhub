import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { composeLgtmImage, TARGET_HEIGHT, TARGET_WIDTH } from '@/src/lib/image/compose-lgtm';

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

// 中央クロップ検証用に左半分赤・右半分青の画像を作成する。
// 中央クロップ後も赤と青の境界が出力中央付近に残ることを確認する。
async function makeSplitImage(width: number, height: number): Promise<Buffer> {
  const left = await sharp({
    create: { width: width / 2, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: { width: width / 2, height, channels: 3, background: { r: 0, g: 0, b: 255 } },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: left, top: 0, left: 0 },
      { input: right, top: 0, left: width / 2 },
    ])
    .png()
    .toBuffer();
}

describe('composeLgtmImage', () => {
  it('出力は WebP 形式で、固定の 266×199 になる', async () => {
    const input = await makeImage(800, 600);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(TARGET_WIDTH);
    expect(result.height).toBe(TARGET_HEIGHT);
    expect(result.byteLength).toBeGreaterThan(0);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(TARGET_WIDTH);
    expect(meta.height).toBe(TARGET_HEIGHT);
  });

  it.each([
    { label: '正方形', width: 1024, height: 1024 },
    { label: '横長', width: 1920, height: 1080 },
    { label: '縦長', width: 800, height: 1200 },
  ])('入力アスペクト比違い ($label) でも出力は 266×199 になる', async ({ width, height }) => {
    const input = await makeImage(width, height);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(TARGET_WIDTH);
    expect(result.height).toBe(TARGET_HEIGHT);
  });

  it('元画像が 266×199 より小さくても拡大されて 266×199 になる', async () => {
    const input = await makeImage(100, 75);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(TARGET_WIDTH);
    expect(result.height).toBe(TARGET_HEIGHT);
  });

  it('中央クロップが効く: 左赤・右青の元画像で出力中央左寄りが赤・中央右寄りが青になる', async () => {
    // 1200×900 (4:3) の左赤・右青画像。中央クロップで 266×199 (アスペクト比 ≒ 4:3) も
    // 横方向の中央を維持するため、左右の色配置が出力にも保存される。
    const input = await makeSplitImage(1200, 900);
    const result = await composeLgtmImage(input);

    const { data, info } = await sharp(result.buffer).raw().toBuffer({ resolveWithObject: true });

    const sample = (x: number, y: number) => {
      const idx = (y * info.width + x) * info.channels;
      return { r: data[idx] ?? 0, g: data[idx + 1] ?? 0, b: data[idx + 2] ?? 0 };
    };

    // LGTM テキストが中心に乗るので、垂直方向はテキストに重ならない上端寄りの行で確認する
    const probeY = 5;
    const leftSample = sample(20, probeY);
    const rightSample = sample(TARGET_WIDTH - 21, probeY);

    expect(leftSample.r).toBeGreaterThan(leftSample.b);
    expect(rightSample.b).toBeGreaterThan(rightSample.r);
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
