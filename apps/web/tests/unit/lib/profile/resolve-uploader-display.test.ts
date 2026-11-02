import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AVATAR_PATH,
  GITHUB_PROFILE_BASE_URL,
  resolveUploaderDisplay,
  UNKNOWN_UPLOADER_NAME,
} from '@/src/lib/profile/resolve-uploader-display';
import type { UserProfile } from '@/src/types/user';

function buildProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    githubLogin: 'octocat',
    displayName: 'The Octocat',
    avatarUrl: 'https://avatars.example.com/octocat.png',
    isAdmin: false,
    createdAt: new Date('2026-05-03T00:00:00.000Z'),
    updatedAt: new Date('2026-05-03T00:00:00.000Z'),
    ...overrides,
  };
}

describe('resolveUploaderDisplay', () => {
  it('profile が undefined のとき Unknown + デフォルトアバター + profileUrl は undefined', () => {
    const result = resolveUploaderDisplay(undefined);

    expect(result).toEqual({
      displayName: UNKNOWN_UPLOADER_NAME,
      avatarUrl: DEFAULT_AVATAR_PATH,
      isFallback: true,
      profileUrl: undefined,
    });
  });

  it('profile が与えられたとき displayName / avatarUrl / GitHub プロフィール URL を返す', () => {
    const profile = buildProfile({
      githubLogin: 'hubot',
      displayName: 'Hubot',
      avatarUrl: 'https://avatars.example.com/hubot.png',
    });

    const result = resolveUploaderDisplay(profile);

    expect(result).toEqual({
      displayName: 'Hubot',
      avatarUrl: 'https://avatars.example.com/hubot.png',
      isFallback: false,
      profileUrl: 'https://github.com/hubot',
    });
  });
});

describe('定数', () => {
  it('UNKNOWN_UPLOADER_NAME は "Unknown"', () => {
    expect(UNKNOWN_UPLOADER_NAME).toBe('Unknown');
  });

  it('DEFAULT_AVATAR_PATH は public 配下の SVG パス', () => {
    expect(DEFAULT_AVATAR_PATH).toBe('/default-avatar.svg');
  });

  it('GITHUB_PROFILE_BASE_URL は GitHub プロフィールのベース URL', () => {
    expect(GITHUB_PROFILE_BASE_URL).toBe('https://github.com/');
  });
});
