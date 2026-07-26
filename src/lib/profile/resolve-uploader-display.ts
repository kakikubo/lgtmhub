import type { UserProfile } from '@/src/types/user';

export const UNKNOWN_UPLOADER_NAME = 'Unknown';
export const DEFAULT_AVATAR_PATH = '/default-avatar.svg';
export const GITHUB_PROFILE_BASE_URL = 'https://github.com/';

export interface UploaderDisplay {
  displayName: string;
  avatarUrl: string;
  isFallback: boolean;
  profileUrl: string | undefined;
}

/**
 * 画像カードに表示する投稿者プレゼンテーション情報を解決する。
 * `profile` が `undefined` の場合 (例: GitHub 連携解除後の参照断) は
 * `Unknown` + デフォルトアバターのフォールバックを返し、`profileUrl` は `undefined` とする。
 */
export function resolveUploaderDisplay(profile: UserProfile | undefined): UploaderDisplay {
  if (!profile) {
    return {
      displayName: UNKNOWN_UPLOADER_NAME,
      avatarUrl: DEFAULT_AVATAR_PATH,
      isFallback: true,
      profileUrl: undefined,
    };
  }
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isFallback: false,
    profileUrl: `${GITHUB_PROFILE_BASE_URL}${profile.githubLogin}`,
  };
}
