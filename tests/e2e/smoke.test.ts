import { expect, test } from '@playwright/test';

test('トップページにヘッダーとログインボタンが表示される(未ログイン)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'LGTMHub' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'GitHub でログイン' })).toBeVisible();
});
