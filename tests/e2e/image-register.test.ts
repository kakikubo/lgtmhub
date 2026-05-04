import { expect, test } from '@playwright/test';

test.describe('画像登録フォーム (未ログイン)', () => {
  test('/images/new に直接アクセスすると / へリダイレクトされ、auth_error クエリが付与される', async ({
    page,
  }) => {
    await page.goto('/images/new');

    await expect(page).toHaveURL(/\/\?auth_error=login_required/);
    // リダイレクト先のトップページで未ログイン誘導が見えていることを併せて確認する
    await expect(page.getByRole('button', { name: 'ログインして登録' })).toBeVisible();
  });

  test('未ログイン時はヘッダーに「画像を登録する」リンクが表示されない', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('header-register-link')).toHaveCount(0);
  });
});
