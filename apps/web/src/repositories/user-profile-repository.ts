import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

/** OAuth の最新値でプロフィールを差分同期する際に更新しうるフィールド (camelCase) */
export interface UserProfileAuthFields {
  avatarUrl?: string;
  displayName?: string;
}

function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    githubLogin: row.github_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isAdmin: row.is_admin,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class UserProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    if (!data) return null;
    return toUserProfile(data);
  }

  async findByIdOrThrow(id: string): Promise<UserProfile> {
    const profile = await this.findById(id);
    if (!profile) throw new NotFoundError('UserProfile', id);
    return profile;
  }

  /**
   * 複数 ID のプロフィールを 1 クエリで取得する (画像一覧での N+1 回避用)。
   * 空配列が渡された場合は Supabase を呼ばずに `[]` を即座に返す。
   * 戻り値の順序は呼び出し側の入力順とは独立 (DB の戻り順) なので、整列が必要なら呼び出し側で行う。
   */
  async findManyByIds(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase.from('user_profiles').select('*').in('id', ids);

    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map(toUserProfile);
  }

  /**
   * OAuth の最新値でプロフィールを部分更新する (GitHub 側のアバター/表示名変更の差分同期用)。
   * 渡された `fields` のうち `undefined` でないものだけを snake_case に変換して UPDATE する。
   * 対象行は RLS (auth.uid() = id) で自分の行に限定され、`updated_at` は DB トリガで自動更新される。
   */
  async updateAuthFields(userId: string, fields: UserProfileAuthFields): Promise<UserProfile> {
    const patch: UserProfileUpdate = {};
    if (fields.avatarUrl !== undefined) patch.avatar_url = fields.avatarUrl;
    if (fields.displayName !== undefined) patch.display_name = fields.displayName;

    const { data, error } = await this.supabase
      .from('user_profiles')
      .update(patch)
      .eq('id', userId)
      .select('*')
      .single();

    if (error) throw new DatabaseError(error.message);
    return toUserProfile(data);
  }
}
