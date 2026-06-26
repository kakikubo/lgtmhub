import sharp, { type Metadata } from 'sharp';
import { BadRequestError } from '@/src/lib/errors';

export const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'gif', 'webp'] as const;
export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

// アニメーション入力 (GIF / WebP) で共有するフレーム数上限。
// Vercel Functions の maxDuration / メモリと sharp の合成所要時間から
// 余裕を持って 150 を上限とする (Issue #201)。
export const MAX_GIF_FRAMES = 150;

function isAllowedFormat(value: string | undefined): value is AllowedImageFormat {
  return typeof value === 'string' && (ALLOWED_IMAGE_FORMATS as readonly string[]).includes(value);
}

export interface ValidatedImage {
  format: AllowedImageFormat;
  width: number;
  height: number;
  // 静止画は 1、アニメ GIF は実フレーム数。compose-lgtm 側で
  // 「アニメーション入力かどうか」の判定ヒントとして利用する。
  pages: number;
}

export function assertSupportedImageMetadata(metadata: Metadata): ValidatedImage {
  if (!isAllowedFormat(metadata.format)) {
    throw new BadRequestError('JPEG・PNG・GIF・WebP 形式の画像を使用してください');
  }
  const pages = metadata.pages ?? 1;
  if (pages > MAX_GIF_FRAMES) {
    throw new BadRequestError(
      `フレーム数が多すぎます (${MAX_GIF_FRAMES} フレーム以下にしてください)`,
    );
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new BadRequestError('画像のサイズを判定できませんでした');
  }
  return { format: metadata.format, width, height, pages };
}

export async function validateImage(buffer: Buffer): Promise<ValidatedImage> {
  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new BadRequestError('画像ファイルが破損しているか、対応していない形式です');
  }
  return assertSupportedImageMetadata(metadata);
}
