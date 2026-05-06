import { readFileSync } from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';
import { BadRequestError } from '@/src/lib/errors';

export const MAX_OUTPUT_WIDTH = 1200;
export const WEBP_QUALITY = 85;

// Vercel サーバレスでは Pango+fontconfig 経由の family 解決が効かず、
// `font: "Archivo Black …"` 指定でもフォールバックフォントで描画されてしまう。
// opentype.js で TTF からアウトラインパスを抽出し、SVG <path> として
// レンダリングすることで、環境依存なく確実に Archivo Black を使えるようにする。
const FONT_PATH = path.join(process.cwd(), 'public/fonts/ArchivoBlack-Regular.ttf');

let cachedFont: opentype.Font | null = null;

function loadFont(): opentype.Font {
  if (cachedFont) return cachedFont;
  const ttf = readFileSync(FONT_PATH);
  const arrayBuffer = ttf.buffer.slice(
    ttf.byteOffset,
    ttf.byteOffset + ttf.byteLength,
  ) as ArrayBuffer;
  cachedFont = opentype.parse(arrayBuffer);
  return cachedFont;
}

export interface ComposedImage {
  buffer: Buffer;
  width: number;
  height: number;
  byteLength: number;
}

async function renderText(
  font: opentype.Font,
  text: string,
  color: string,
  fontSize: number,
  strokeWidth: number,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // librsvg+sharp は path のオフセットが小数だと一部グリフをドロップし、
  // ビューポートが path bbox にぴったりだとさらに別の取りこぼしが発生する。
  // 整数オフセット + 余白付きキャンバス + sharp.trim() の組み合わせで安定化する。
  const generousPadding = fontSize;
  const advance = font.getAdvanceWidth(text, fontSize);
  const measurePath = font.getPath(text, 0, 0, fontSize);
  const bbox = measurePath.getBoundingBox();

  const xMin = Math.min(0, bbox.x1);
  const xMax = Math.max(advance, bbox.x2);
  const canvasWidth = Math.ceil(xMax - xMin + generousPadding * 2);
  const canvasHeight = Math.ceil(bbox.y2 - bbox.y1 + generousPadding * 2);

  const offsetX = Math.round(-xMin + generousPadding);
  const offsetY = Math.round(-bbox.y1 + generousPadding);
  const drawPath = font.getPath(text, offsetX, offsetY, fontSize);
  const pathData = drawPath.toPathData(2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">
  <path d="${pathData}" fill="${color}"/>
</svg>`;

  const trimThreshold = Math.max(1, Math.floor(strokeWidth / 2));
  const out = await sharp(Buffer.from(svg))
    .trim({ threshold: trimThreshold })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

// SVG の text-stroke 相当が無いため、黒文字を半径 strokeWidth の円内へ
// 多重コンポジットして縁取りをフェイクし、その上に白文字を 1 枚重ねる。
async function buildLgtmOverlay(
  canvasWidth: number,
  canvasHeight: number,
  text: string,
): Promise<Buffer> {
  const fontSize = Math.max(24, Math.floor(canvasWidth * 0.15));
  const strokeWidth = Math.max(2, Math.floor(fontSize * 0.08));
  const font = loadFont();

  const [black, white] = await Promise.all([
    renderText(font, text, 'black', fontSize, strokeWidth),
    renderText(font, text, 'white', fontSize, strokeWidth),
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
