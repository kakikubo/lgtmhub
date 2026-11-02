import { expect, test } from '@playwright/test';
import { SEED_IMAGES } from './fixtures/seed-images';

// Issue #279: 一覧が空 / エラーのときの test.skip() を廃止し、
// supabase/seed.sql の決定的なフィクスチャへ直接遷移して無条件に検証する。

test.describe('画像削除 UI (未ログイン)', () => {
  test('未ログインで画像詳細を開いても「画像を削除」トリガーは表示されない', async ({ page }) => {
    await page.goto(`/images/${SEED_IMAGES[0].id}`);

    await expect(page.getByTestId('image-detail-page')).toBeVisible();
    // 未ログインなので isOwner=false → 削除トリガーは描画されない
    await expect(page.getByTestId('image-delete-trigger')).toHaveCount(0);
  });
});
