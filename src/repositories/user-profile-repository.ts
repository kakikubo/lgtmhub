import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

type UserProfileRow = Database['public']['Tables']['user_profiles']['Row'];

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
}
