import type { SupabaseClient } from '@supabase/supabase-js';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

export interface UserProfileServiceDeps {
  userProfileRepo: UserProfileRepository;
}

export class UserProfileService {
  private readonly userProfileRepo: UserProfileRepository;

  constructor(deps: UserProfileServiceDeps) {
    this.userProfileRepo = deps.userProfileRepo;
  }

  /**
   * 単一ユーザーのプロフィールを取得する (Header / Layout など 1 件参照向け)。
   * 該当行が無ければ `null` を返し、404 への変換は呼び出し側 (Server Component) の責務とする。
   */
  async findById(id: string): Promise<UserProfile | null> {
    return this.userProfileRepo.findById(id);
  }

  /**
   * 複数ユーザーのプロフィールを 1 クエリで取得する (画像一覧などの N+1 回避用)。
   *
   * - 入力 `ids` が空配列のときは Repository を呼ばない (Repository 側でも同じガードがあるが、
   *   Service 層でも明示することで「呼び出し側は 0 件入力を気にしなくて良い」契約を表明する)
   * - 内部で id を重複排除してから Repository に渡す。同じ uploader が複数回現れる画像一覧で
   *   無駄に id を膨らませないため
   * - 戻り値は配列のまま返し、Map 化など presentation 都合の変換は呼び出し側で行う
   */
  async findManyByIds(ids: string[]): Promise<UserProfile[]> {
    if (ids.length === 0) return [];
    const unique = Array.from(new Set(ids));
    return this.userProfileRepo.findManyByIds(unique);
  }
}

export function buildUserProfileService(supabase: SupabaseClient<Database>): UserProfileService {
  return new UserProfileService({
    userProfileRepo: new UserProfileRepository(supabase),
  });
}
