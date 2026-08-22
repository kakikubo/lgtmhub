import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, DuplicateFavoriteError, NotFoundError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';
import type { Favorite } from '@/src/types/favorite';
import type { PublicLgtmImage } from '@/src/types/image';

type FavoriteRow = Database['public']['Tables']['favorites']['Row'];
type LgtmImageRow = Database['public']['Tables']['lgtm_images']['Row'];

// PostgreSQL のエラーコード。Supabase (PostgREST) は error.code にそのまま載せてくる。
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

export interface ListFavoritesOptions {
  userId: string;
  cursor?: string;
  limit: number;
}

// お気に入り一覧 1 件分。画像本体 + お気に入り登録日時。
export interface FavoriteWithImage {
  image: PublicLgtmImage;
  favoritedAt: Date;
}

// 埋め込み select で取得する lgtm_images 側のカラム。
// 一覧カードの描画に必要な公開フィールドのみに絞る (originalUrl / p_hash 等は引かない)。
type EmbeddedImage = Pick<
  LgtmImageRow,
  'id' | 'image_url' | 'uploader_id' | 'width' | 'height' | 'is_animated'
>;

const EMBEDDED_IMAGE_COLUMNS = 'id, image_url, uploader_id, width, height, is_animated';

function toFavorite(row: FavoriteRow): Favorite {
  return {
    id: row.id,
    userId: row.user_id,
    lgtmImageId: row.lgtm_image_id,
    createdAt: new Date(row.created_at),
  };
}

/**
 * 埋め込み画像 + お気に入り登録日時を一覧用の型へ変換する。
 *
 * `createdAt` には **お気に入り登録日時** を詰める (画像の登録日時ではない)。
 * 一覧の並び順・カーソルがお気に入り登録日時基準であり、UI もこの値でページングするため。
 */
function toFavoriteWithImage(favoritedAt: string, image: EmbeddedImage): FavoriteWithImage {
  return {
    image: {
      id: image.id,
      imageUrl: image.image_url,
      uploaderId: image.uploader_id,
      width: image.width,
      height: image.height,
      isAnimated: image.is_animated,
      createdAt: new Date(favoritedAt),
    },
    favoritedAt: new Date(favoritedAt),
  };
}

export class FavoriteRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * お気に入りを登録する。
   *
   * UNIQUE 制約 (user_id, lgtm_image_id) 違反は「すでに登録済み」なので DuplicateFavoriteError、
   * FK 違反は「画像が存在しない」なので NotFoundError に変換する。Service 側の事前存在チェックと
   * この INSERT の間に画像が削除されるレース (TOCTOU) もここで NotFound に倒れる。
   */
  async create(userId: string, lgtmImageId: string): Promise<Favorite> {
    const { data, error } = await this.supabase
      .from('favorites')
      .insert({ user_id: userId, lgtm_image_id: lgtmImageId })
      .select('*')
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new DuplicateFavoriteError();
      if (error.code === FOREIGN_KEY_VIOLATION) throw new NotFoundError('画像', lgtmImageId);
      throw new DatabaseError(error.message);
    }
    if (!data) throw new DatabaseError('favorites の作成結果が空でした');
    return toFavorite(data);
  }

  /**
   * お気に入りを解除する。所有者を WHERE 句で強制し、RLS と二重で他人の行を弾く (多層防御)。
   *
   * @returns 削除行数 (0 = 未登録 / 他人の行, 1 = 成功)
   */
  async delete(userId: string, lgtmImageId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('lgtm_image_id', lgtmImageId)
      .select('id');

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).length;
  }

  /**
   * お気に入り一覧を画像本体つきで取得する。
   *
   * `lgtm_images!inner` にすることで status のフィルタが内部結合として効き、
   * 論理削除済み画像のお気に入りは行ごと返らない (left join だと画像が null の行が残る)。
   * cursor は前ページ末尾の favorites.created_at (ISO 8601) を渡し `<` で次ページを取得する。
   */
  async listWithImages(options: ListFavoritesOptions): Promise<FavoriteWithImage[]> {
    let query = this.supabase
      .from('favorites')
      .select(`created_at, lgtm_images!inner(${EMBEDDED_IMAGE_COLUMNS})`)
      .eq('user_id', options.userId)
      .eq('lgtm_images.status', 'active')
      .order('created_at', { ascending: false })
      .limit(options.limit);

    if (options.cursor) {
      query = query.lt('created_at', options.cursor);
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map((row) => toFavoriteWithImage(row.created_at, row.lgtm_images));
  }

  /**
   * 自分がお気に入り登録済みの画像 ID を全件返す。
   * 一覧カード / 詳細ページのハートの初期状態 (塗りつぶし or 輪郭) を決めるために使う。
   *
   * 論理削除済み画像は導線上表示されないため JOIN で絞らない (id の集合として持っていても害がなく、
   * JOIN を省くぶん軽い)。件数が肥大化したら「表示中の画像 ID で絞る」方式へ切り替える。
   */
  async listImageIds(userId: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('favorites')
      .select('lgtm_image_id')
      .eq('user_id', userId);

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map((row) => row.lgtm_image_id);
  }
}
