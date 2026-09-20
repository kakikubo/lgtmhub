import { expect, test } from '@playwright/test';

// 未ログイン視点のお気に入り機能 (Issue #198)。
// ログイン済みの登録 → 一覧 → 解除は favorites-authenticated.test.ts で検証する。

test.describe('お気に入り (未ログイン)', () => {
  test('ヘッダーにお気に入りリンクが表示されない', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('header-favorites-link')).toHaveCount(0);
  });

  test('/favorites に直接アクセスするとログイン誘導が表示される', async ({ page }) => {
    const response = await page.goto('/favorites');

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'お気に入り' })).toBeVisible();
    await expect(page.getByTestId('favorites-signin-prompt')).toBeVisible();
    // 未ログインなので一覧もその空状態も出さない
    await expect(page.getByTestId('favorites-grid')).toHaveCount(0);
    await expect(page.getByTestId('favorites-empty')).toHaveCount(0);
  });

  test('一覧カードのハートは未ログインでも表示される', async ({ page }) => {
    await page.goto('/');

    // Issue #279: supabase/seed.sql の決定的なフィクスチャがあるので grid は必ず出る。
    // goto 直後は skeleton のことがあるため、可視になるまで待ってから判定する。
    const grid = page.getByTestId('image-grid');
    await expect(grid).toBeVisible();

    const favorite = grid.getByTestId('favorite-button').first();
    await expect(favorite).toHaveAttribute('data-favorite-state', 'off');
    await expect(favorite).toHaveAttribute('aria-label', 'お気に入りに追加');
  });
});
