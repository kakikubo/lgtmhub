import { expect, test } from '@playwright/test';

test.describe('画像一覧画面 (未ログイン)', () => {
  test('トップページに見出しと、画像グリッド / empty / error state のいずれかが表示される', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'LGTM 画像一覧' })).toBeVisible();

    const grid = page.getByTestId('image-grid');
    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    // データ有無 / Supabase 接続可否に依存しないよう、いずれかの状態が表示されていることだけ保証する
    await expect(grid.or(empty).or(error)).toBeVisible();
  });

  test('未ログイン誘導 (「ログインして登録」) が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ログインして登録' })).toBeVisible();
  });
});
