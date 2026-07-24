import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Header } from '@/components/header';
import type { UserProfile } from '@/src/types/user';

const getUser = vi.fn();
const findById = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

vi.mock('@/src/services/user-profile-service', () => ({
  buildUserProfileService: () => ({ findById }),
}));

// server action は本テストでは呼ばないため、モジュール解決を通すためだけのスタブ
vi.mock('@/src/lib/auth/actions', () => ({
  signInWithGithub: vi.fn(),
  signOut: vi.fn(),
}));

const PROFILE: UserProfile = {
  id: 'user-1',
  githubLogin: 'octocat',
  displayName: 'Octo Cat',
  avatarUrl: 'https://avatars.example.com/octocat.png',
  isAdmin: false,
  createdAt: new Date('2026-05-18T00:00:00.000Z'),
  updatedAt: new Date('2026-05-18T00:00:00.000Z'),
};

beforeEach(() => {
  getUser.mockReset();
  findById.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('Header', () => {
  it('未ログインならログインボタンを出し、プロフィールを取得しない', async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    render(await Header());

    expect(screen.getByRole('button', { name: 'GitHub でログイン' })).toBeInTheDocument();
    expect(screen.queryByTestId('header-register-link')).not.toBeInTheDocument();
    expect(findById).not.toHaveBeenCalled();
  });

  it('ログイン済みなら登録リンク・表示名・アバター・ログアウトを出す', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    findById.mockResolvedValue(PROFILE);

    render(await Header());

    expect(screen.getByTestId('header-register-link')).toHaveAttribute('href', '/images/new');
    expect(screen.getByText('Octo Cat')).toBeInTheDocument();
    // next/image は unoptimized 指定が無いと src を /_next/image?url=... に書き換えるため、
    // 厳密一致ではなく元 URL がエンコードされて含まれることを確認する
    expect(screen.getByAltText('Octo Cat').getAttribute('src')).toContain(
      encodeURIComponent('https://avatars.example.com/octocat.png'),
    );
    expect(screen.getByRole('button', { name: 'ログアウト' })).toBeInTheDocument();
    expect(findById).toHaveBeenCalledWith('user-1');
  });
});
