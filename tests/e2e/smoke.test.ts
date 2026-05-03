import { test, expect } from '@playwright/test';

test('トップページが表示される(scaffolding smoke test)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'LGTMHub' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'scaffolding 完了' })).toBeVisible();
});
