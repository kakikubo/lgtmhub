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
