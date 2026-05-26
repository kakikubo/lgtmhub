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

  // Issue #128: 投稿者情報を一覧から詳細ページへ移動。詳細ページでは
  // 「投稿者： アバター 表示名」が必ず描画される (fallback でも Unknown + デフォルトアバター)。
  // データ有無に依存しないよう、image-list.test.ts と同じく「empty/error のときはスキップ」パターン。
  test('詳細ページに投稿者行 (アバター + 表示名) が表示される', async ({ page }) => {
    await page.goto('/');

    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    if ((await empty.count()) > 0 || (await error.count()) > 0) {
      test.skip();
    }

    const firstLink = page.getByTestId('image-card-link').first();
    await firstLink.click();
    await expect(page.getByTestId('image-detail-page')).toBeVisible();

    const uploader = page.getByTestId('image-detail-uploader');
    await expect(uploader).toBeVisible();
    await expect(uploader).toContainText('投稿者：');
    // アバター画像は装飾扱いの alt="" だが、src は必ず付く
    await expect(uploader.locator('img')).toHaveAttribute('src', /.+/);
  });

  // Issue #128: profile 取得済みカードでは表示名が GitHub プロフィールへの
  // 新規タブリンクになる。fallback (Unknown) のときはリンクを張らない。
  // Issue #147: アバター画像 (アイコン) もクリックで投稿者プロフィールへ遷移できるよう、
  // アバターと表示名を 1 本の `<a>` でラップする (リンクが冗長化しない構造)。
  test('投稿者プロフィール取得済みのとき、アバターと表示名は同じ GitHub プロフィールへの新規タブリンクになる', async ({
    page,
  }) => {
    await page.goto('/');

    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    if ((await empty.count()) > 0 || (await error.count()) > 0) {
      test.skip();
    }

    const firstLink = page.getByTestId('image-card-link').first();
    await firstLink.click();
    await expect(page.getByTestId('image-detail-page')).toBeVisible();

    const uploader = page.getByTestId('image-detail-uploader');
    const fallback = await uploader.getAttribute('data-fallback');
    if (fallback !== 'false') {
      test.skip(true, 'profile が取得できなかったため (fallback) 検証をスキップ');
    }

    const anchors = uploader.locator('a');
    await expect(anchors).toHaveCount(1);

    const anchor = anchors.first();
    const href = await anchor.getAttribute('href');
    expect(href).toMatch(/^https:\/\/github\.com\/.+/);
    await expect(anchor).toHaveAttribute('target', '_blank');
    const rel = (await anchor.getAttribute('rel')) ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');

    // 同じリンク内にアバター画像と表示名が両方含まれる (= アイコンクリックでも遷移できる)
    await expect(anchor.locator('img')).toHaveAttribute('src', /.+/);
    await expect(anchor).toContainText(/.+/);
  });
});
