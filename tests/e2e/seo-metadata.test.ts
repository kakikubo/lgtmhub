import { expect, test } from '@playwright/test';
import { SEED_IMAGES } from './fixtures/seed-images';

// Issue #375: 共有時のプレビュー (OGP) とクローラー向けの sitemap / robots を検証する。
// e2e はローカル / CI (Vercel 外) で動くため、ベース URL は localhost、robots は全面拒否になる。

const SEED_IMAGE = SEED_IMAGES[0];

test.describe('SEO メタデータ', () => {
  test.describe('クローラーとしてアクセス', () => {
    // generateMetadata の結果は通常のブラウザには <body> 末尾へストリーミングされる。
    // 共有プレビューを作るクローラー (htmlLimitedBots) には <head> にブロッキング出力されるため、
    // クローラーの UA で「プレビューに使われる <head>」を検証する
    test.use({ userAgent: 'Twitterbot/1.0' });

    test('画像詳細ページに画像固有の title と OGP / Twitter Card が出る', async ({ page }) => {
      await page.goto(`/images/${SEED_IMAGE.id}`);
      await expect(page.getByTestId('image-detail-page')).toBeVisible();

      await expect(page).toHaveTitle(`LGTM 画像 (${SEED_IMAGE.id.slice(0, 8)}) | LGTMHub`);

      // 相対 URL は metadataBase で絶対 URL に解決される
      const meta = (selector: string) => page.locator(`head ${selector}`).first();
      await expect(meta('meta[property="og:image"]')).toHaveAttribute(
        'content',
        new URL(SEED_IMAGE.imageUrl, 'http://localhost:3000').href,
      );
      await expect(meta('meta[property="og:image:width"]')).toHaveAttribute('content', /^\d+$/);
      await expect(meta('meta[property="og:image:height"]')).toHaveAttribute('content', /^\d+$/);
      await expect(meta('meta[property="og:url"]')).toHaveAttribute(
        'content',
        `http://localhost:3000/images/${SEED_IMAGE.id}`,
      );
      await expect(meta('meta[name="twitter:card"]')).toHaveAttribute(
        'content',
        'summary_large_image',
      );
      await expect(meta('link[rel="canonical"]')).toHaveAttribute(
        'href',
        `http://localhost:3000/images/${SEED_IMAGE.id}`,
      );
    });
  });

  test('トップページは既定の title と OGP を持つ', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('LGTMHub');
    await expect(page.locator('head meta[property="og:site_name"]').first()).toHaveAttribute(
      'content',
      'LGTMHub',
    );
  });

  test('sitemap.xml にトップとシード画像の詳細ページが含まれる', async ({ request }) => {
    const response = await request.get('/sitemap.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('<loc>http://localhost:3000/</loc>');
    for (const image of SEED_IMAGES) {
      expect(body).toContain(`<loc>http://localhost:3000/images/${image.id}</loc>`);
    }
  });

  test('Production 以外の robots.txt は全面的にクロールを拒否する', async ({ request }) => {
    const response = await request.get('/robots.txt');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('User-Agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Sitemap:');
  });
});
