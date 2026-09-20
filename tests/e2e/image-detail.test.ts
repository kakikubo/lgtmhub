import { expect, test } from '@playwright/test';
import { SEED_IMAGES, SEED_UPLOADER } from './fixtures/seed-images';

// Issue #279: 以前は一覧が空 / エラーのとき test.skip() していたため、CI では
// 何もアサートされていなかった。supabase/seed.sql の決定的なフィクスチャを前提に無条件で検証する。

const SEED_IMAGE = SEED_IMAGES[0];

test.describe('画像詳細ページ', () => {
  test('一覧の先頭サムネイルから /images/{uuid} に遷移する', async ({ page }) => {
    await page.goto('/');

    const firstLink = page.getByTestId('image-card-link').first();
    await expect(firstLink).toBeVisible();
    await firstLink.click();

    await expect(page).toHaveURL(/\/images\/[0-9a-f-]+$/i);
    await expect(page.getByTestId('image-detail-page')).toBeVisible();
    await expect(page.getByTestId('image-detail-back-link')).toBeVisible();
  });

  test('存在しない UUID では 404 ページ (noindex の soft 404) が表示される', async ({ page }) => {
    // cacheComponents (loading.tsx の Suspense 境界) 下ではレスポンスが 200 で
    // ストリーミング開始され、ヘッダー送信後の notFound() は HTTP ステータスを
    // 404 に変更できない。Next.js は代わりに <meta name="robots" content="noindex">
    // を出力してクローラのインデックスを防ぐ (公式に「soft 404」と案内される挙動)。
    // よって HTTP ステータスではなく noindex メタと 404 UI の表示で not-found を検証する。
    const response = await page.goto('/images/00000000-0000-0000-0000-000000000000');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/);
    // Next.js 標準 404 ページの h1 (本ファイルでは not-found.tsx を追加しないためデフォルト出力)。
    // h2 "This page could not be found." も同時に表示されるが、role+level 指定で h1 のみを狙う
    await expect(page.getByRole('heading', { name: '404', level: 1 })).toBeVisible();
  });

  // Issue #128: 投稿者情報を一覧から詳細ページへ移動。詳細ページでは
  // 「投稿者： アバター 表示名」が必ず描画される (fallback でも Unknown + デフォルトアバター)。
  // 投稿者を決め打ちで検証するため、一覧経由ではなくシード画像へ直接遷移する。
  test('詳細ページに投稿者行 (アバター + 表示名) が表示される', async ({ page }) => {
    await page.goto(`/images/${SEED_IMAGE.id}`);
    await expect(page.getByTestId('image-detail-page')).toBeVisible();

    const uploader = page.getByTestId('image-detail-uploader');
    await expect(uploader).toBeVisible();
    await expect(uploader).toContainText('投稿者：');
    await expect(uploader).toContainText(SEED_UPLOADER.displayName);
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
    await page.goto(`/images/${SEED_IMAGE.id}`);
    await expect(page.getByTestId('image-detail-page')).toBeVisible();

    const uploader = page.getByTestId('image-detail-uploader');
    // シード画像の投稿者は user_profiles を持つので fallback にはならない
    await expect(uploader).toHaveAttribute('data-fallback', 'false');

    const anchors = uploader.locator('a');
    await expect(anchors).toHaveCount(1);

    const anchor = anchors.first();
    await expect(anchor).toHaveAttribute('href', SEED_UPLOADER.profileUrl);
    await expect(anchor).toHaveAttribute('target', '_blank');
    const rel = (await anchor.getAttribute('rel')) ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');

    // 同じリンク内にアバター画像と表示名が両方含まれる (= アイコンクリックでも遷移できる)
    await expect(anchor.locator('img')).toHaveAttribute('src', /.+/);
    await expect(anchor).toContainText(SEED_UPLOADER.displayName);
  });
});
