import { expect, test } from '@playwright/test';

test.describe('画像削除 UI (未ログイン)', () => {
  test('未ログインで画像詳細を開いても「画像を削除」トリガーは表示されない', async ({ page }) => {
    await page.goto('/');

    // 一覧が空 / エラーのときは詳細に到達できないのでスキップ
    // image-detail.test.ts と同じ「データ有無に依存しない」方針
    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    if ((await empty.count()) > 0 || (await error.count()) > 0) {
      test.skip();
    }

    const firstLink = page.getByTestId('image-card-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();

    await expect(page.getByTestId('image-detail-page')).toBeVisible();
    // 未ログインなので isOwner=false → 削除トリガーは描画されない
    await expect(page.getByTestId('image-delete-trigger')).toHaveCount(0);
  });
});
