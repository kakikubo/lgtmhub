import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UploaderProfileRow } from '@/components/uploader-profile-row';
import type { UserProfile } from '@/src/types/user';

const PROFILE: UserProfile = {
  id: 'user-1',
  githubLogin: 'octocat',
  displayName: 'octocat',
  avatarUrl: 'https://avatars.example.com/octocat.png',
  isAdmin: false,
  createdAt: new Date('2026-05-18T00:00:00.000Z'),
  updatedAt: new Date('2026-05-18T00:00:00.000Z'),
};

describe('UploaderProfileRow', () => {
  it('プロフィールありなら GitHub へのリンクと表示名を出す', () => {
    render(<UploaderProfileRow profile={PROFILE} />);

    const row = screen.getByTestId('image-detail-uploader');
    expect(row).toHaveAttribute('data-fallback', 'false');

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://github.com/octocat');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('octocat')).toBeInTheDocument();
  });

  it('プロフィールが null なら fallback 表示になりリンクを張らない', () => {
    render(<UploaderProfileRow profile={null} />);

    const row = screen.getByTestId('image-detail-uploader');
    expect(row).toHaveAttribute('data-fallback', 'true');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
