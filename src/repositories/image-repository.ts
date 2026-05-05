import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';
import type { ImageStatus, LgtmImage } from '@/src/types/image';

type LgtmImageRow = Database['public']['Tables']['lgtm_images']['Row'];
type LgtmImageInsert = Database['public']['Tables']['lgtm_images']['Insert'];

export interface CreateLgtmImageInput {
  uploaderId: string;
  originalUrl: string;
  imageUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  status?: ImageStatus;
}

export interface ActivePHashEntry {
  id: string;
  pHash: string;
}

export interface ListImagesOptions {
  cursor?: string;
  limit: number;
}

function toLgtmImage(row: LgtmImageRow): LgtmImage {
  return {
    id: row.id,
    uploaderId: row.uploader_id,
    originalUrl: row.original_url,
    imageUrl: row.image_url,
    pHash: row.p_hash,
    width: row.width,
    height: row.height,
    fileSizeBytes: row.file_size_bytes,
    mimeType: row.mime_type,
    // DB 側の CHECK 制約 (status in ('processing','active','deleted')) で値域は保証済み。
    // Supabase 自動生成の型は CHECK を反映しないため、ガイドライン許容例外として narrowing する。
    status: row.status as ImageStatus,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toInsert(input: CreateLgtmImageInput): LgtmImageInsert {
  return {
    uploader_id: input.uploaderId,
    original_url: input.originalUrl,
    image_url: input.imageUrl,
    p_hash: input.pHash,
    width: input.width,
    height: input.height,
    file_size_bytes: input.fileSizeBytes,
    mime_type: input.mimeType,
    status: input.status ?? 'active',
  };
}

export class ImageRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * 詳細ページ用に閲覧可能 (status='active') な 1 件を取得する。
   * 該当無し / 論理削除済み (status='deleted') は `null` を返す。
   */
  async findActiveById(id: string): Promise<LgtmImage | null> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .select('*')
      .eq('id', id)
      .eq('status', 'active')
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    if (!data) return null;
    return toLgtmImage(data);
  }

  async create(input: CreateLgtmImageInput): Promise<LgtmImage> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .insert(toInsert(input))
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    if (!data) throw new DatabaseError('lgtm_images の作成結果が空でした');
    return toLgtmImage(data);
  }

  /**
   * 論理削除する。所有者・active 状態を WHERE 句で同時に強制し、
   * RLS と二重で「他人の画像」「既削除」を弾く (多層防御)。
   *
   * @returns 更新行数 (0 = 該当なし: 存在しない/他人/既削除, 1 = 成功)
   */
  async softDelete(id: string, userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('uploader_id', userId)
      .eq('status', 'active')
      .select('id');

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).length;
  }

  /**
   * 重複検出用に閲覧可能な (status='active') 画像の pHash を一括取得する。
   * 件数増加時 (10 万件超) は pgvector への移行を検討する (architecture.md 参照)。
   */
  async listActivePHashes(): Promise<ActivePHashEntry[]> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .select('id, p_hash')
      .eq('status', 'active');

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map((row) => ({ id: row.id, pHash: row.p_hash }));
  }

  /**
   * 一覧表示用に閲覧可能な (status='active') 画像を新着順で取得する。
   * cursor は前ページ末尾の created_at (ISO 8601) を渡し、`<` で次ページを取得する。
   */
  async list(options: ListImagesOptions): Promise<LgtmImage[]> {
    let query = this.supabase
      .from('lgtm_images')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(options.limit);

    if (options.cursor) {
      query = query.lt('created_at', options.cursor);
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map(toLgtmImage);
  }
}
