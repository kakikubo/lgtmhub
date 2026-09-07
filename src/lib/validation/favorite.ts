import { z } from 'zod';
import { imageListItemSchema } from '@/src/lib/validation/image';

// POST /api/favorites のリクエストボディ
export const createFavoriteRequestSchema = z.object({
  lgtmImageId: z.string().uuid('画像 ID が不正です'),
});

export type CreateFavoriteRequest = z.infer<typeof createFavoriteRequestSchema>;

// DELETE /api/favorites/[lgtmImageId] のパスパラメータ
export const favoriteImageIdParamSchema = z.object({
  lgtmImageId: z.string().uuid('画像 ID が不正です'),
});

// お気に入り一覧の既定件数。画像一覧 (16) と別値なのは functional-design.md の
// お気に入り一覧 API 仕様 (デフォルト 20 / 最大 50) に合わせるため。
export const LIST_FAVORITES_DEFAULT_LIMIT = 20;
export const LIST_FAVORITES_MAX_LIMIT = 50;

export const listFavoritesQuerySchema = z.object({
  cursor: z.string().datetime({ message: 'cursor は ISO 8601 形式で指定してください' }).optional(),
  limit: z.coerce
    .number()
    .int('limit は整数で指定してください')
    .min(1, 'limit は 1 以上で指定してください')
    .max(LIST_FAVORITES_MAX_LIMIT, `limit は ${LIST_FAVORITES_MAX_LIMIT} 以下で指定してください`)
    .optional(),
});

export type ListFavoritesQuery = z.infer<typeof listFavoritesQuerySchema>;

// POST /api/favorites の 201 レスポンス
export const createFavoriteResponseSchema = z.object({
  id: z.string().min(1),
  lgtmImageId: z.string().min(1),
});

export type CreateFavoriteResponse = z.infer<typeof createFavoriteResponseSchema>;

// GET /api/favorites のレスポンス。
// 画像一覧 (GET /api/images) と同じ形にすることで ImageGrid / LoadMoreButton を無改造で流用できる。
// ただし createdAt は「お気に入り登録日時」(favorites.created_at) であり画像の登録日時ではない。
export const listFavoritesResponseSchema = z.object({
  images: z.array(imageListItemSchema),
  nextCursor: z.string().nullable(),
});

export type ListFavoritesResponse = z.infer<typeof listFavoritesResponseSchema>;

// GET /api/favorites/ids のレスポンス。
// 一覧カード / 詳細ページのハートの初期状態を決めるためにクライアントが 1 度だけ取得する。
export const favoriteImageIdsResponseSchema = z.object({
  lgtmImageIds: z.array(z.string()),
});

export type FavoriteImageIdsResponse = z.infer<typeof favoriteImageIdsResponseSchema>;
