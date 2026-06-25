import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from '@/src/lib/errors';
import { composeLgtmImage, MAX_LONG_SIDE } from '@/src/lib/image/compose-lgtm';
import { MAX_GIF_FRAMES } from '@/src/lib/image/validate-image';

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

async function makeAnimatedGif(
  frameWidth: number,
  frameHeight: number,
  frameCount: number,
): Promise<Buffer> {
  const channels = 3;
  const stripe = Buffer.alloc(frameWidth * frameHeight * frameCount * channels);
  // フレーム間で必ず差分が出るよう RGB 3 チャンネルすべてを毎フレーム変える。
  // 同一フレーム連続だと sharp の GIF エンコーダがフレームを deduplicate して
  // 出力 pages が n より少なくなる。
  for (let i = 0; i < frameCount; i++) {
    for (let p = 0; p < frameWidth * frameHeight; p++) {
      const offset = (i * frameWidth * frameHeight + p) * channels;
      stripe[offset] = (i * 7) % 250;
      stripe[offset + 1] = (i * 3) % 200;
      stripe[offset + 2] = (i * 5) % 240;
    }
  }
  // pageHeight は raw 入力側に指定し、delay は frameCount 個用意する
  // (sharp の GifOptions は pageHeight を持たない / delay 長さがフレーム数と
  // 一致しないと隣接同一とみなされ pages がマージされることがある)。
  const delays = new Array(frameCount).fill(100);
  return sharp(stripe, {
    raw: { width: frameWidth, height: frameHeight * frameCount, channels, pageHeight: frameHeight },
  })
    .gif({ loop: 0, delay: delays })
    .toBuffer();
}

describe('composeLgtmImage (静止画)', () => {
  it('出力は WebP 形式で、長辺が MAX_LONG_SIDE になる (横長 1920×1080 → 400×225)', async () => {
    const input = await makeImage(1920, 1080);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(MAX_LONG_SIDE);
    expect(result.height).toBe(225);
    expect(result.byteLength).toBeGreaterThan(0);
    expect(result.isAnimated).toBe(false);

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
    expect(result.isAnimated).toBe(false);
  });

  it('原画が MAX_LONG_SIDE 未満の場合は拡大されず原画サイズで保存される (300×200 → 300×200)', async () => {
    const input = await makeImage(300, 200);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(300);
    expect(result.height).toBe(200);
    expect(result.isAnimated).toBe(false);
  });

  it('原画長辺がちょうど MAX_LONG_SIDE のときは元サイズが維持される (400×300 → 400×300)', async () => {
    const input = await makeImage(400, 300);
    const result = await composeLgtmImage(input);

    expect(result.width).toBe(400);
    expect(result.height).toBe(300);
    expect(result.isAnimated).toBe(false);
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

describe('composeLgtmImage (アニメーション GIF, Issue #201)', () => {
  it('アニメ GIF 入力からアニメーション WebP (pages=N) を出力する', async () => {
    const input = await makeAnimatedGif(80, 60, 5);
    const result = await composeLgtmImage(input);

    expect(result.isAnimated).toBe(true);
    expect(result.byteLength).toBeGreaterThan(0);

    // アニメ WebP の pageHeight を見るには { animated: true } で再読み込みする必要がある
    // (sharp はデフォルトでは先頭フレームのメタデータしか返さない)。
    const meta = await sharp(result.buffer, { animated: true }).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.pages).toBe(5);
    // 1 フレーム単位 (80×60) は MAX_LONG_SIDE 未満なので元サイズが維持される
    expect(meta.width).toBe(80);
    expect(meta.pageHeight).toBe(60);
    expect(result.width).toBe(80);
    expect(result.height).toBe(60);
  });

  it('1 フレーム単位の長辺が MAX_LONG_SIDE 超なら 1 フレーム単位でリサイズされる', async () => {
    // 1 フレーム 800×600 の 3 フレーム → 400×300 × 3 フレームのアニメ WebP
    const input = await makeAnimatedGif(800, 600, 3);
    const result = await composeLgtmImage(input);

    expect(result.isAnimated).toBe(true);
    expect(result.width).toBe(400);
    expect(result.height).toBe(300);

    const meta = await sharp(result.buffer, { animated: true }).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.pages).toBe(3);
    expect(meta.pageHeight).toBe(300);
  });

  it(`フレーム数が ${MAX_GIF_FRAMES} 超なら BadRequestError を throw する (二重防御)`, async () => {
    // 実 sharp で MAX_GIF_FRAMES+1 フレームの GIF を生成して挙動を確かめる。
    // GIF サイズは小さく (4×4) して合成コストを最小化する。
    const input = await makeAnimatedGif(4, 4, MAX_GIF_FRAMES + 1);
    await expect(composeLgtmImage(input)).rejects.toBeInstanceOf(BadRequestError);
  });
});
