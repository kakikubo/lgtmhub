import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type UserProfileAuthFields,
  UserProfileRepository,
} from '@/src/repositories/user-profile-repository';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

export interface UserProfileServiceDeps {
  userProfileRepo: UserProfileRepository;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * OAuth の user_metadata (信頼できない unknown) から非空 string 値を安全に取り出す。
 * object でない / 該当キーが string でない / 空文字の場合は undefined を返す
 * (空文字は「未設定」寄りの値とみなし、既存値を空で上書きしない)。
 */
function readString(meta: unknown, key: string): string | undefined {
  if (!isRecord(meta)) return undefined;
  const value = meta[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
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

  /**
   * OAuth ログイン時に GitHub 側の最新値でプロフィールを差分同期する (Issue #11)。
   *
   * - `meta` は `user.user_metadata` (信頼できない unknown) を想定し、型ガードで string のみ抽出する
   * - `displayName` は handle_new_user トリガと同じ優先順位 (`full_name → name → user_name`) で導出する
   * - 抽出できたフィールドのみを部分更新し、更新対象が 1 件も無ければ Repository を呼ばず `null` を返す
   *   (該当キーが無いプロバイダや不正な meta で既存値を空文字などに上書きしないため)
   */
  async syncFromAuth(userId: string, meta: unknown): Promise<UserProfile | null> {
    const avatarUrl = readString(meta, 'avatar_url');
    const displayName =
      readString(meta, 'full_name') ?? readString(meta, 'name') ?? readString(meta, 'user_name');

    const fields: UserProfileAuthFields = {};
    if (avatarUrl !== undefined) fields.avatarUrl = avatarUrl;
    if (displayName !== undefined) fields.displayName = displayName;

    if (Object.keys(fields).length === 0) return null;
    return this.userProfileRepo.updateAuthFields(userId, fields);
  }
}

export function buildUserProfileService(supabase: SupabaseClient<Database>): UserProfileService {
  return new UserProfileService({
    userProfileRepo: new UserProfileRepository(supabase),
  });
}
