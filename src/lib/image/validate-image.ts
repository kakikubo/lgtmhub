import sharp from 'sharp';
import { BadRequestError } from '@/src/lib/errors';

export const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'gif'] as const;
export type AllowedImageFormat = (typeof ALLOWED_IMAGE_FORMATS)[number];

function isAllowedFormat(value: string | undefined): value is AllowedImageFormat {
  return typeof value === 'string' && (ALLOWED_IMAGE_FORMATS as readonly string[]).includes(value);
}

export interface ValidatedImage {
  format: AllowedImageFormat;
  width: number;
  height: number;
}

export function assertSupportedImageMetadata(metadata: sharp.Metadata): ValidatedImage {
  if (!isAllowedFormat(metadata.format)) {
    throw new BadRequestError('JPEG・PNG・GIF 形式の画像を使用してください');
  }
  if (metadata.format === 'gif' && (metadata.pages ?? 1) > 1) {
    throw new BadRequestError('アニメーション GIF は登録できません (静止画のみ対応)');
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new BadRequestError('画像のサイズを判定できませんでした');
  }
  return { format: metadata.format, width, height };
}

export async function validateImage(buffer: Buffer): Promise<ValidatedImage> {
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new BadRequestError('画像ファイルが破損しているか、対応していない形式です');
  }
  return assertSupportedImageMetadata(metadata);
}
