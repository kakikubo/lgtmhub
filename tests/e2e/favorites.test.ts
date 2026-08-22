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

    const grid = page.getByTestId('image-grid');
    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    // 状態が確定してから判定する (goto 直後は skeleton で grid が未表示のため)
    await expect(grid.or(empty).or(error)).toBeVisible();
    if ((await empty.count()) > 0 || (await error.count()) > 0) {
      test.skip(true, '画像が無い (empty / error state) ため検証をスキップ');
    }

    const favorite = grid.getByTestId('favorite-button').first();
    await expect(favorite).toHaveAttribute('data-favorite-state', 'off');
    await expect(favorite).toHaveAttribute('aria-label', 'お気に入りに追加');
  });
});
