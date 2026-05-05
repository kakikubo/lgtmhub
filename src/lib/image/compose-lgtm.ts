import path from 'node:path';
import sharp from 'sharp';
import { BadRequestError } from '@/src/lib/errors';

export const MAX_OUTPUT_WIDTH = 1200;
export const WEBP_QUALITY = 85;

// Vercel サーバレスにシステムフォントが無いため、リポジトリ同梱の TTF を fontfile で明示する
const FONT_PATH = path.join(process.cwd(), 'public/fonts/ArchivoBlack-Regular.ttf');
const FONT_FAMILY = 'Archivo Black';

export interface ComposedImage {
  buffer: Buffer;
  width: number;
  height: number;
  byteLength: number;
}

function escapePangoMarkup(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

async function renderText(
  text: string,
  color: string,
  fontSize: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const safe = escapePangoMarkup(text);
  const { data, info } = await sharp({
    text: {
      text: `<span foreground="${color}">${safe}</span>`,
      font: `${FONT_FAMILY} ${fontSize}`,
      fontfile: FONT_PATH,
      rgba: true,
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, width: info.width, height: info.height };
}

// Pango には text-stroke 相当が無いため、黒文字を半径 strokeWidth の円内へ
// 多重コンポジットして縁取りをフェイクし、その上に白文字を 1 枚重ねる。
async function buildLgtmOverlay(
  canvasWidth: number,
  canvasHeight: number,
  text: string,
): Promise<Buffer> {
  const fontSize = Math.max(24, Math.floor(canvasWidth * 0.15));
  const strokeWidth = Math.max(2, Math.floor(fontSize * 0.08));

  const [black, white] = await Promise.all([
    renderText(text, 'black', fontSize),
    renderText(text, 'white', fontSize),
  ]);

  const top = Math.round((canvasHeight - white.height) / 2);
  const left = Math.round((canvasWidth - white.width) / 2);

  const composites: sharp.OverlayOptions[] = [];
  const radiusSq = strokeWidth * strokeWidth;
  for (let dy = -strokeWidth; dy <= strokeWidth; dy++) {
    for (let dx = -strokeWidth; dx <= strokeWidth; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (dx * dx + dy * dy > radiusSq) continue;
      composites.push({
        input: black.buffer,
        top: top + dy,
        left: left + dx,
      });
    }
  }
  composites.push({ input: white.buffer, top, left });

  return sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

export async function composeLgtmImage(buffer: Buffer): Promise<ComposedImage> {
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new BadRequestError('画像のサイズを判定できませんでした');
  }

  const targetWidth = Math.min(originalWidth, MAX_OUTPUT_WIDTH);
  const targetHeight = Math.round((originalHeight * targetWidth) / originalWidth);

  const overlay = await buildLgtmOverlay(targetWidth, targetHeight, 'LGTM');

  const composed = await sharp(buffer)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .composite([{ input: overlay, blend: 'over' }])
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: composed.data,
    width: composed.info.width,
    height: composed.info.height,
    byteLength: composed.info.size,
  };
}
