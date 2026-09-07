import type { SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError } from '@/src/lib/errors';
import { LIST_FAVORITES_DEFAULT_LIMIT } from '@/src/lib/validation/favorite';
import { FavoriteRepository } from '@/src/repositories/favorite-repository';
import { ImageRepository } from '@/src/repositories/image-repository';
import type { Database } from '@/src/types/database.types';
import type { Favorite } from '@/src/types/favorite';
import type { PublicLgtmImage } from '@/src/types/image';

export interface ListFavoritesParams {
  userId: string;
  cursor?: string;
  limit?: number;
}

export interface ListFavoritesResult {
  images: PublicLgtmImage[];
  nextCursor: string | null;
}

export interface FavoriteServiceDeps {
  favoriteRepo: FavoriteRepository;
  imageRepo: ImageRepository;
}

export class FavoriteService {
  private readonly favoriteRepo: FavoriteRepository;
  private readonly imageRepo: ImageRepository;

  constructor(deps: FavoriteServiceDeps) {
    this.favoriteRepo = deps.favoriteRepo;
    this.imageRepo = deps.imageRepo;
  }

  /**
   * お気に入りを登録する (PRD 機能 4-A)。
   *
   * 先に `findActiveById` で存在確認するのは、FK 違反 (23503) だけに頼ると
   * 「論理削除済み画像 (行は存在する)」を弾けないため。存在確認と INSERT の間に
   * 物理削除された場合の TOCTOU は Repository の FK 違反 → NotFoundError で最終的に整合する。
   *
   * @throws NotFoundError - 画像が存在しない / 論理削除済み
   * @throws DuplicateFavoriteError - すでに登録済み
   */
  async addFavorite(userId: string, lgtmImageId: string): Promise<Favorite> {
    const image = await this.imageRepo.findActiveById(lgtmImageId);
    if (!image) {
      throw new NotFoundError('画像', lgtmImageId);
    }

    return this.favoriteRepo.create(userId, lgtmImageId);
  }

  /**
   * お気に入りを解除する (PRD 機能 4-A)。
   *
   * 削除行数が 0 のとき (未登録 / すでに解除済み) は NotFoundError に倒し、Route が 404 を返す。
   * UI 側は「望む状態 (未登録) と一致している」ためこれをエラー扱いせず、冪等な操作として扱う
   * (functional-design.md のお気に入り解除の冪等性を参照)。
   *
   * @throws NotFoundError - 当該ユーザーの該当お気に入りが存在しない
   */
  async removeFavorite(userId: string, lgtmImageId: string): Promise<void> {
    const deleted = await this.favoriteRepo.delete(userId, lgtmImageId);
    if (deleted === 0) {
      throw new NotFoundError('お気に入り', lgtmImageId);
    }
  }

  /**
   * お気に入り一覧をカーソルページネーションで取得する (PRD 機能 4-B)。
   *
   * `ImageService.listImages` と同じ規約:
   * - `limit` ちょうどで返ってきた場合のみ `nextCursor` を返す (最終ページでは null)
   * - `nextCursor` は前ページ末尾の **お気に入り登録日時** の ISO 文字列
   *
   * 論理削除済み画像の除外は Repository の `lgtm_images!inner` + `status='active'` が担う。
   */
  async listFavorites(params: ListFavoritesParams): Promise<ListFavoritesResult> {
    const limit = params.limit ?? LIST_FAVORITES_DEFAULT_LIMIT;
    const records = await this.favoriteRepo.listWithImages({
      userId: params.userId,
      cursor: params.cursor,
      limit,
    });

    const images = records.map((record) => record.image);
    const last = records[records.length - 1];
    const nextCursor = records.length === limit && last ? last.favoritedAt.toISOString() : null;
    return { images, nextCursor };
  }

  /**
   * 自分がお気に入り登録済みの画像 ID を返す。
   * クライアントが一覧カード / 詳細ページのハートの初期状態を決めるために 1 度だけ取得する。
   */
  async listFavoriteImageIds(userId: string): Promise<string[]> {
    return this.favoriteRepo.listImageIds(userId);
  }
}

export function buildFavoriteService(supabase: SupabaseClient<Database>): FavoriteService {
  return new FavoriteService({
    favoriteRepo: new FavoriteRepository(supabase),
    imageRepo: new ImageRepository(supabase),
  });
}
