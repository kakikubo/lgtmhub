import sharp from 'sharp';
import { BadRequestError } from '@/src/lib/errors';

export const MAX_OUTPUT_WIDTH = 1200;
export const WEBP_QUALITY = 85;

export interface ComposedImage {
  buffer: Buffer;
  width: number;
  height: number;
  byteLength: number;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function buildLgtmSvg(width: number, height: number, text: string): string {
  const fontSize = Math.max(24, Math.floor(width * 0.15));
  const strokeWidth = Math.max(2, Math.floor(fontSize * 0.08));
  const safeText = escapeXml(text);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text
    x="50%" y="50%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Arial Black, sans-serif"
    font-size="${fontSize}"
    font-weight="900"
    fill="white"
    stroke="black"
    stroke-width="${strokeWidth}"
    paint-order="stroke"
  >${safeText}</text>
</svg>`;
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

  const overlay = Buffer.from(buildLgtmSvg(targetWidth, targetHeight, 'LGTM'));

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
