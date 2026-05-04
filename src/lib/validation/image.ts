import { z } from 'zod';

export const createImageRequestSchema = z.object({
  imageUrl: z
    .string()
    .min(1, '画像 URL を入力してください')
    .max(2048, '画像 URL が長すぎます (最大 2048 文字)')
    .url('画像 URL の形式が正しくありません')
    .startsWith('https://', 'HTTPS の URL を入力してください'),
});

export type CreateImageRequest = z.infer<typeof createImageRequestSchema>;

export const LIST_IMAGES_DEFAULT_LIMIT = 20;
export const LIST_IMAGES_MAX_LIMIT = 50;

export const listImagesQuerySchema = z.object({
  cursor: z.string().datetime({ message: 'cursor は ISO 8601 形式で指定してください' }).optional(),
  limit: z.coerce
    .number()
    .int('limit は整数で指定してください')
    .min(1, 'limit は 1 以上で指定してください')
    .max(LIST_IMAGES_MAX_LIMIT, `limit は ${LIST_IMAGES_MAX_LIMIT} 以下で指定してください`)
    .optional(),
});

export type ListImagesQuery = z.infer<typeof listImagesQuerySchema>;

// クライアントが GET /api/images のレスポンスを fetch().json() で受けたときに、
// any の握り潰しを避けて runtime バリデーションするためのスキーマ
export const listImagesResponseSchema = z.object({
  images: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      uploaderId: z.string(),
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});

export type ListImagesResponse = z.infer<typeof listImagesResponseSchema>;
