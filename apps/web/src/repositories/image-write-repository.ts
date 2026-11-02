import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, ForbiddenError, NotFoundError } from '@/src/lib/errors';
import { toLgtmImage } from '@/src/repositories/image-repository';
import type { Database } from '@/src/types/database.types';
import type { LgtmImage } from '@/src/types/image';

const FORBIDDEN_PG_CODE = '42501';

export interface CreateLgtmImageInput {
  uploaderId: string;
  originalUrl: string;
  imageUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  isAnimated: boolean;
}

export interface UpdateAfterRegenerateInput {
  imageUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  isAnimated: boolean;
  // 差し替え時のみ設定。未指定なら DB の originalUrl は据え置き
  originalUrl?: string;
}

/**
 * lgtm_images への書き込み専用 Repository。
 *
 * anon / authenticated には lgtm_images の書き込み権限が無く、書き込みは service_role だけが
 * 実行できる RPC に限られる。そのため service_role クライアントを使う。
 * クライアントは最初の書き込みで生成し、キー未設定なら書き込みだけを失敗させる
 * (一覧・詳細の読み取りは ImageRepository 側で影響を受けない)。
 */
export class ImageWriteRepository {
  private client: SupabaseClient<Database> | null = null;

  constructor(private readonly createClient: () => SupabaseClient<Database>) {}

  private get supabase(): SupabaseClient<Database> {
    this.client ??= this.createClient();
    return this.client;
  }

  async create(input: CreateLgtmImageInput): Promise<LgtmImage> {
    const { data, error } = await this.supabase
      .rpc('create_lgtm_image', {
        p_uploader_id: input.uploaderId,
        p_original_url: input.originalUrl,
        p_image_url: input.imageUrl,
        p_p_hash: input.pHash,
        p_width: input.width,
        p_height: input.height,
        p_file_size_bytes: input.fileSizeBytes,
        p_mime_type: input.mimeType,
        p_is_animated: input.isAnimated,
      })
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('lgtm_images の作成結果が空でした');
    return toLgtmImage(data);
  }

  /**
   * 論理削除する。所有者・active 状態は RPC の WHERE 句で強制し、
   * Service 層の所有者チェックと二重で「他人の画像」「既削除」を弾く (多層防御)。
   *
   * @returns 更新行数 (0 = 該当なし: 存在しない/他人/既削除, 1 = 成功)
   */
  async softDelete(id: string, userId: string): Promise<number> {
    const { data, error } = await this.supabase.rpc('soft_delete_lgtm_image', {
      p_id: id,
      p_uploader_id: userId,
    });

    if (error) throw new DatabaseError(error.message);
    if (typeof data !== 'number') {
      throw new DatabaseError('soft_delete_lgtm_image が予期しない値を返しました');
    }
    return data;
  }

  /**
   * 管理者による再生成後の DB 更新。RPC 内でも requesterId の管理者判定を行い、
   * 非管理者は ForbiddenError に倒す。status='active' な行のみ更新し、
   * 論理削除済み/存在しない場合は NotFoundError に倒す。
   * `originalUrl` は差し替え時のみ更新する (undefined なら据え置き)。
   */
  async updateAfterRegenerate(
    id: string,
    requesterId: string,
    patch: UpdateAfterRegenerateInput,
  ): Promise<LgtmImage> {
    const { data, error } = await this.supabase
      .rpc('update_lgtm_image_after_regenerate', {
        p_id: id,
        p_requester_id: requesterId,
        p_image_url: patch.imageUrl,
        p_p_hash: patch.pHash,
        p_width: patch.width,
        p_height: patch.height,
        p_file_size_bytes: patch.fileSizeBytes,
        p_is_animated: patch.isAnimated,
        p_original_url: patch.originalUrl,
      })
      .maybeSingle();

    if (error) {
      if (error.code === FORBIDDEN_PG_CODE) throw new ForbiddenError();
      throw new DatabaseError(error.message);
    }
    if (!data) throw new NotFoundError('画像', id);
    return toLgtmImage(data);
  }
}
