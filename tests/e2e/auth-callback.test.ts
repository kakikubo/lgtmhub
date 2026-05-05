import { expect, test } from '@playwright/test';

// このファイルは playwright.config.ts の `authenticated` プロジェクトでのみ実行され、
// globalSetup が生成した storageState (sb-...-auth-token cookie) を読み込んだ状態で動く。
// 結果として、OAuth callback の `exchangeCodeForSession` 成功パスと等価な session が
// 立っている前提でのレンダリングを E2E で検証する。

test.describe('OAuth callback 成功後 (ログイン済み) の挙動', () => {
  test('ヘッダーに表示名・アバター・ログアウト・登録リンクが表示される', async ({ page }) => {
    await page.goto('/');

    // ヘッダー上の認証済み UI 群
    await expect(page.getByTestId('header-register-link')).toBeVisible();
    await expect(page.getByText('E2E Test User')).toBeVisible();
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible();
    // アバター画像 (handle_new_user トリガで avatar_url が user_profiles に入る)
    await expect(page.getByRole('img', { name: 'E2E Test User' })).toBeVisible();
  });

  test('トップページに未ログイン誘導が表示されない', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'GitHub でログイン' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'ログインして登録' })).toHaveCount(0);
  });

  test('/images/new に直接アクセスしてもリダイレクトされない', async ({ page }) => {
    const response = await page.goto('/images/new');

    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/images\/new$/);
    // 未ログイン時の auth_error クエリが付かないことを担保
    await expect(page).not.toHaveURL(/auth_error=login_required/);
  });
});
