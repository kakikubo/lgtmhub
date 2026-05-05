import { expect, test } from '@playwright/test';

test.describe('画像詳細ページ', () => {
  test('一覧の先頭サムネイルから /images/{uuid} に遷移する', async ({ page }) => {
    await page.goto('/');

    // 一覧が空 (CI placeholder env / 開発初期) の場合は遷移できないのでスキップする。
    // image-list.test.ts と同じく「データ有無に依存しない」方針
    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    if ((await empty.count()) > 0 || (await error.count()) > 0) {
      test.skip();
    }

    const firstLink = page.getByTestId('image-card-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();

    await expect(page).toHaveURL(/\/images\/[0-9a-f-]+$/i);
    await expect(page.getByTestId('image-detail-page')).toBeVisible();
    await expect(page.getByTestId('image-detail-back-link')).toBeVisible();
  });

  test('存在しない UUID では Next.js の 404 ページが表示される', async ({ page }) => {
    const response = await page.goto('/images/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(404);
    // Next.js 標準 404 ページの h1 (本ファイルでは not-found.tsx を追加しないためデフォルト出力)。
    // h2 "This page could not be found." も同時に表示されるが、role+level 指定で h1 のみを狙う
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
  });
});
