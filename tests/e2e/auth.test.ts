import { test, expect } from '@playwright/test';

test.describe('未ログイン時の認証 UI', () => {
  test('ヘッダーに GitHub ログインボタンが表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'GitHub でログイン' })).toBeVisible();
  });

  test('トップページに「ログインして登録」誘導が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ログインして登録' })).toBeVisible();
  });
});
