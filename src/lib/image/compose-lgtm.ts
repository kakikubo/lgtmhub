import { readFileSync } from 'node:fs';
import path from 'node:path';
import { type Font, parse as parseFont } from 'opentype.js';
import sharp from 'sharp';
import { BadRequestError } from '@/src/lib/errors';
import { MAX_GIF_FRAMES } from '@/src/lib/image/validate-image';

export const MAX_LONG_SIDE = 400;
export const WEBP_QUALITY = 85;

// Vercel サーバレスでは Pango+fontconfig 経由の family 解決が効かず、
// `font: "Archivo Black …"` 指定でもフォールバックフォントで描画されてしまう。
// opentype.js で TTF からアウトラインパスを抽出し、SVG <path> として
// レンダリングすることで、環境依存なく確実に Archivo Black を使えるようにする。
const FONT_PATH = path.join(process.cwd(), 'public/fonts/ArchivoBlack-Regular.ttf');

let cachedFont: Font | null = null;

function loadFont(): Font {
  if (cachedFont) return cachedFont;
  const ttf = readFileSync(FONT_PATH);
  const arrayBuffer = ttf.buffer.slice(
    ttf.byteOffset,
    ttf.byteOffset + ttf.byteLength,
  ) as ArrayBuffer;
  cachedFont = parseFont(arrayBuffer);
  return cachedFont;
}

export interface ComposedImage {
  buffer: Buffer;
  width: number;
  height: number;
  byteLength: number;
  // アニメーション WebP として出力したかどうか。DB の lgtm_images.is_animated に格納される。
  isAnimated: boolean;
}

async function renderText(
  font: Font,
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

// 長辺を MAX_LONG_SIDE に揃える (元アスペクト比保持・原画 < MAX は拡大しない)。
// 長辺ちょうどを MAX_LONG_SIDE に固定し、短辺は floor で切り捨てる。
// 極端なアスペクト比 (10000×1 等) では短辺が 0 に潰れて sharp の resize が
// 失敗するため、最小 1px に clamp する。
// アニメ入力は 1 フレーム単位 (width × pageHeight) で判定する必要があるため、
// composeLgtmImage と共有できるよう関数化した。
function resolveTargetSize(
  originalWidth: number,
  originalHeight: number,
): { width: number; height: number } {
  const longSide = Math.max(originalWidth, originalHeight);
  if (longSide <= MAX_LONG_SIDE) {
    return { width: originalWidth, height: originalHeight };
  }
  if (originalWidth >= originalHeight) {
    return {
      width: MAX_LONG_SIDE,
      height: Math.max(1, Math.floor((originalHeight * MAX_LONG_SIDE) / originalWidth)),
    };
  }
  return {
    width: Math.max(1, Math.floor((originalWidth * MAX_LONG_SIDE) / originalHeight)),
    height: MAX_LONG_SIDE,
  };
}

export async function composeLgtmImage(buffer: Buffer): Promise<ComposedImage> {
  // 1 回目の metadata はアニメ判定用。`{ animated: true }` 無しでも `pages` は取れる。
  const metadata = await sharp(buffer).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  if (originalWidth <= 0 || originalHeight <= 0) {
    throw new BadRequestError('画像のサイズを判定できませんでした');
  }

  const pages = metadata.pages ?? 1;
  // validate-image でも弾いているが、Service レイヤを介さない呼び出しに対する
  // 二重防御として compose 側でも上限チェックを行う。
  if (pages > MAX_GIF_FRAMES) {
    throw new BadRequestError(
      `フレーム数が多すぎます (${MAX_GIF_FRAMES} フレーム以下にしてください)`,
    );
  }

  const isAnimated = pages > 1;

  if (!isAnimated) {
    // 静止画パス: 既存ロジックを踏襲する
    const { width: targetWidth, height: targetHeight } = resolveTargetSize(
      originalWidth,
      originalHeight,
    );
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
      isAnimated: false,
    };
  }

  // アニメ入力パス: `{ animated: true }` で読み込むと sharp は全フレームを
  // 縦に連結した 1 枚の画像として扱う (height = pageHeight × pages)。
  // この状態で resize → composite → webp すると sharp がアニメーション WebP を吐く。
  const animatedMeta = await sharp(buffer, { animated: true }).metadata();
  const pageHeight = animatedMeta.pageHeight ?? originalHeight;
  if (pageHeight <= 0) {
    throw new BadRequestError('アニメーション画像のフレーム高さを判定できませんでした');
  }

  // アスペクト比は 1 フレーム単位で計算する (animatedMeta.height は縦タイル合計)。
  const { width: targetWidth, height: targetPageHeight } = resolveTargetSize(
    originalWidth,
    pageHeight,
  );
  if (targetPageHeight <= 0) {
    throw new BadRequestError('アニメーション画像のフレーム高さを判定できませんでした');
  }

  // 1 フレーム分のオーバーレイを 1 回だけ作り、全フレームの該当位置に同一オーバーレイを重ねる。
  // sharp の `{ animated: true }` 入力は全フレームを縦タイル化して扱うため、
  // resize に渡す高さは **1 フレーム分** (= targetPageHeight) で良い (sharp が内部で
  // 全 pages にこれを適用する)。composite の top はリサイズ後の各フレームの開始位置 (= i * targetPageHeight) を渡す。
  const overlay = await buildLgtmOverlay(targetWidth, targetPageHeight, 'LGTM');
  const composites: sharp.OverlayOptions[] = [];
  for (let i = 0; i < pages; i++) {
    composites.push({
      input: overlay,
      blend: 'over',
      top: i * targetPageHeight,
      left: 0,
    });
  }

  const composed = await sharp(buffer, { animated: true })
    .resize(targetWidth, targetPageHeight, { fit: 'fill' })
    .composite(composites)
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: composed.data,
    width: composed.info.width,
    height: composed.info.pageHeight ?? composed.info.height,
    byteLength: composed.info.size,
    isAnimated: true,
  };
}
