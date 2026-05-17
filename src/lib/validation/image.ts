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

export const LIST_IMAGES_DEFAULT_LIMIT = 16;
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

// 投稿者プロフィール (UserProfile を JSON シリアライズした形)。
// createdAt / updatedAt は Date が JSON 上 ISO 文字列になるため string で受ける。
// LoadMoreButton が ImageGrid にアバターを渡すために GET /api/images が同梱する。
export const userProfileResponseSchema = z.object({
  id: z.string(),
  githubLogin: z.string(),
  displayName: z.string(),
  avatarUrl: z.string(),
  isAdmin: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type UserProfileResponse = z.infer<typeof userProfileResponseSchema>;

// クライアントが GET /api/images のレスポンスを fetch().json() で受けたときに、
// any の握り潰しを避けて runtime バリデーションするためのスキーマ
export const listImagesResponseSchema = z.object({
  images: z.array(
    z.object({
      id: z.string(),
      imageUrl: z.string(),
      uploaderId: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      createdAt: z.string(),
    }),
  ),
  // 投稿者の重複排除済みプロフィール一覧。取得失敗時はサーバー側で [] に degrade する。
  profiles: z.array(userProfileResponseSchema),
  nextCursor: z.string().nullable(),
});

export type ListImagesResponse = z.infer<typeof listImagesResponseSchema>;

// POST /api/images の 201 レスポンス
export const createImageResponseSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
});

export type CreateImageResponse = z.infer<typeof createImageResponseSchema>;

// POST /api/images のエラーレスポンス (4xx / 5xx)。409 のときだけ existingImageId が付く
export const createImageErrorResponseSchema = z.object({
  error: z.string().min(1),
  existingImageId: z.string().min(1).optional(),
});

export type CreateImageErrorResponse = z.infer<typeof createImageErrorResponseSchema>;
