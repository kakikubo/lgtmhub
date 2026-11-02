import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError } from '@/src/lib/errors';
import { buildKeysetOrFilter, type KeysetCursor } from '@/src/lib/pagination/keyset-cursor';
import type { Database } from '@/src/types/database.types';
import type { ImageStatus, LgtmImage } from '@/src/types/image';

type LgtmImageRow = Database['public']['Tables']['lgtm_images']['Row'];

export interface ActivePHashEntry {
  id: string;
  pHash: string;
}

export interface ListImagesOptions {
  cursor?: KeysetCursor;
  limit: number;
}

export function toLgtmImage(row: LgtmImageRow): LgtmImage {
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
    isAnimated: row.is_animated,
    // DB 側の CHECK 制約 (status in ('processing','active','deleted')) で値域は保証済み。
    // Supabase 自動生成の型は CHECK を反映しないため、ガイドライン許容例外として narrowing する。
    status: row.status as ImageStatus,
    deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
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
   * 管理者による再生成時の重複検出用に、指定 id を除外した閲覧可能画像の pHash 一覧を返す。
   * 自レコード ID を除外することで「同一 URL を再取得しても自己衝突しない」を実現する。
   */
  async listActivePHashesExcept(excludeId: string): Promise<ActivePHashEntry[]> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .select('id, p_hash')
      .eq('status', 'active')
      .neq('id', excludeId);

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map((row) => ({ id: row.id, pHash: row.p_hash }));
  }

  /**
   * ランダム抽出の母集合用に、閲覧可能な (status='active') 画像の id を全件取得する。
   * 本体カラムを引かないため `listActivePHashes()` (id + p_hash 全件) より遥かに軽量。
   * 件数が 10 万件超に達したら RPC / pgvector 化を検討する (architecture.md と同基準)。
   */
  async listActiveIds(): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('lgtm_images')
      .select('id')
      .eq('status', 'active');

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map((row) => row.id);
  }

  /**
   * 指定 id 群のうち閲覧可能な (status='active') 画像を取得する。
   * `.in` の返却順は不定なため、表示順は呼び出し元 (Service) で整列する。
   * ids が空のときは Supabase を呼ばず空配列を返す (空配列ガード)。
   */
  async findManyActiveByIds(ids: string[]): Promise<LgtmImage[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase
      .from('lgtm_images')
      .select('*')
      .eq('status', 'active')
      .in('id', ids);

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map(toLgtmImage);
  }

  /**
   * 一覧表示用に閲覧可能な (status='active') 画像を新着順で取得する。
   * 並びは `(created_at desc, id desc)`。cursor は前ページ末尾の `{ createdAt, id }` を渡し、
   * PostgREST `.or()` の複合 keyset で次ページを取得する (Issue #327)。
   */
  async list(options: ListImagesOptions): Promise<LgtmImage[]> {
    let query = this.supabase
      .from('lgtm_images')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(options.limit);

    if (options.cursor) {
      query = query.or(buildKeysetOrFilter(options.cursor));
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map(toLgtmImage);
  }
}
