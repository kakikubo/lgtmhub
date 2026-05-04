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
    status: row.status,
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
}
