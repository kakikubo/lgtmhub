/**
 * LGTM フォント比較プレビュー用スクリプト。
 *
 * opentype.js で TTF からグリフのアウトラインパスを直接抽出し、SVG <path> として
 * レンダリングする。compose-lgtm.ts と同じ多重コンポジット手順で縁取りを再現した
 * 合成 PNG を tmp/lgtm-preview/ に書き出す。
 *
 * Pango/fontconfig や librsvg の @font-face に依存しない方式なので、macOS ホストでも
 * 期待通りに各フォントのレンダリングを差し替えできる。
 *
 * 実行: npx tsx scripts/preview-lgtm-fonts.ts
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import opentype from 'opentype.js';
import sharp from 'sharp';

interface FontCandidate {
  family: string;
  filename: string;
}

const FONTS: FontCandidate[] = [
  { family: 'Archivo Black', filename: 'public/fonts/ArchivoBlack-Regular.ttf' },
  { family: 'Bowlby One', filename: 'public/fonts/_preview/BowlbyOne-Regular.ttf' },
  { family: 'Bungee', filename: 'public/fonts/_preview/Bungee-Regular.ttf' },
  { family: 'Russo One', filename: 'public/fonts/_preview/RussoOne-Regular.ttf' },
  { family: 'Rubik Mono One', filename: 'public/fonts/_preview/RubikMonoOne-Regular.ttf' },
  { family: 'Alfa Slab One', filename: 'public/fonts/_preview/AlfaSlabOne-Regular.ttf' },
];

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const FONT_SIZE = Math.max(24, Math.floor(CANVAS_WIDTH * 0.15));
const STROKE_WIDTH = Math.max(2, Math.floor(FONT_SIZE * 0.08));
const TEXT = 'LGTM';
const OUTPUT_DIR = path.join(process.cwd(), 'tmp/lgtm-preview');

async function renderTextToPng(
  font: opentype.Font,
  text: string,
  color: string,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  // librsvg+sharp は path のオフセットが小数だと一部グリフをドロップする (Bungee で再現)。
  // 整数に丸めることで安定して全文字を描画できる。さらに、ビューポートが path bbox に
  // ぴったりだと別の取りこぼしが発生 (Rubik Mono One) するため余白を確保 → trim する。
  const generousPadding = FONT_SIZE;
  const advance = font.getAdvanceWidth(text, FONT_SIZE);
  const otPath = font.getPath(text, 0, 0, FONT_SIZE);
  const bbox = otPath.getBoundingBox();
  const xMin = Math.min(0, bbox.x1);
  const xMax = Math.max(advance, bbox.x2);
  const width = Math.ceil(xMax - xMin + generousPadding * 2);
  const height = Math.ceil(bbox.y2 - bbox.y1 + generousPadding * 2);

  const offsetX = Math.round(-xMin + generousPadding);
  const offsetY = Math.round(-bbox.y1 + generousPadding);
  const offsetPath = font.getPath(text, offsetX, offsetY, FONT_SIZE);
  const pathData = offsetPath.toPathData(2);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <path d="${pathData}" fill="${color}"/>
</svg>`;

  const out = await sharp(Buffer.from(svg)).trim().png().toBuffer({ resolveWithObject: true });
  return { buffer: out.data, width: out.info.width, height: out.info.height };
}

async function renderForFont(candidate: FontCandidate): Promise<Buffer> {
  const ttf = readFileSync(path.join(process.cwd(), candidate.filename));
  // ArrayBuffer に変換してから parse (opentype.js v2 API)
  const arrayBuffer = ttf.buffer.slice(
    ttf.byteOffset,
    ttf.byteOffset + ttf.byteLength,
  ) as ArrayBuffer;
  const font = opentype.parse(arrayBuffer);
  const [black, white] = await Promise.all([
    renderTextToPng(font, TEXT, 'black'),
    renderTextToPng(font, TEXT, 'white'),
  ]);

  const top = Math.round((CANVAS_HEIGHT - white.height) / 2);
  const left = Math.round((CANVAS_WIDTH - white.width) / 2);

  const composites: sharp.OverlayOptions[] = [];
  const radiusSq = STROKE_WIDTH * STROKE_WIDTH;
  for (let dy = -STROKE_WIDTH; dy <= STROKE_WIDTH; dy++) {
    for (let dx = -STROKE_WIDTH; dx <= STROKE_WIDTH; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (dx * dx + dy * dy > radiusSq) continue;
      composites.push({ input: black.buffer, top: top + dy, left: left + dx });
    }
  }
  composites.push({ input: white.buffer, top, left });

  return sharp({
    create: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      channels: 3,
      background: { r: 70, g: 110, b: 160 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

function fontSlug(family: string): string {
  return family.toLowerCase().replaceAll(' ', '-');
}

async function main(): Promise<void> {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const font of FONTS) {
    const fontPath = path.join(process.cwd(), font.filename);
    if (!existsSync(fontPath)) {
      console.warn(`SKIP: フォントファイルが見つかりません: ${fontPath}`);
      continue;
    }
    const buffer = await renderForFont(font);
    const outPath = path.join(OUTPUT_DIR, `${fontSlug(font.family)}.png`);
    await sharp(buffer).toFile(outPath);
    console.log(`✓ ${font.family.padEnd(18)} → ${path.relative(process.cwd(), outPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
