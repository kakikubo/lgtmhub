import type { UserProfile } from '@/src/types/user';

export const UNKNOWN_UPLOADER_NAME = 'Unknown';
export const DEFAULT_AVATAR_PATH = '/default-avatar.svg';

export interface UploaderDisplay {
  displayName: string;
  avatarUrl: string;
  isFallback: boolean;
}

/**
 * 画像カードに表示する投稿者プレゼンテーション情報を解決する。
 * `profile` が `undefined` の場合 (例: GitHub 連携解除後の参照断) は
 * `Unknown` + デフォルトアバターのフォールバックを返す。
 */
export function resolveUploaderDisplay(profile: UserProfile | undefined): UploaderDisplay {
  if (!profile) {
    return {
      displayName: UNKNOWN_UPLOADER_NAME,
      avatarUrl: DEFAULT_AVATAR_PATH,
      isFallback: true,
    };
  }
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isFallback: false,
  };
}
