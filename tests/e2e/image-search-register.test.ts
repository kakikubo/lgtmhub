import { expect, test } from '@playwright/test';

// playwright.config.ts の `authenticated` プロジェクトでのみ実行される。
// globalSetup が生成した storageState (sb-...-auth-token cookie) を読み込んだ状態で動く。
// 外部 Pexels API と既存の画像登録フローはネットワーク層でモックする。

const SEARCH_API = '**/api/images/search?**';
const REGISTER_API = '**/api/images';

test.describe('画像検索→登録フロー (ログイン済み)', () => {
  test.beforeEach(async ({ page }) => {
    // 検索 API をモック
    await page.route(SEARCH_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            {
              id: 'pexels:1',
              thumbnailUrl: 'https://example.com/cat-thumb.jpg',
              imageUrl: 'https://example.com/cat-large.jpg',
              width: 800,
              height: 600,
              alt: 'a cat',
              provider: 'pexels',
              attribution: {
                photographer: 'Joey',
                photographerUrl: 'https://www.pexels.com/@joey',
                sourceUrl: 'https://www.pexels.com/photo/1',
              },
            },
            {
              id: 'pexels:2',
              thumbnailUrl: 'https://example.com/dog-thumb.jpg',
              imageUrl: 'https://example.com/dog-large.jpg',
              width: 800,
              height: 600,
              alt: 'a dog',
              provider: 'pexels',
              attribution: {
                photographer: 'Mia',
                photographerUrl: 'https://www.pexels.com/@mia',
                sourceUrl: 'https://www.pexels.com/photo/2',
              },
            },
          ],
          page: 1,
          hasNextPage: false,
          provider: 'pexels',
        }),
      });
    });

    // 既存登録 API は実呼び出しを避け、モックで 201 を返す
    await page.route(REGISTER_API, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-4000-8000-000000000001',
          imageUrl: 'https://blob.vercel-storage.com/lgtm/sample.webp',
        }),
      });
    });
  });

  test('タブ切替→検索→画像選択→登録でトップへ遷移する', async ({ page }) => {
    await page.goto('/images/new');

    // デフォルトは URL 入力タブ
    await expect(page.getByTestId('image-register-form')).toBeVisible();

    // 検索タブへ切替
    await page.getByTestId('image-register-tab-search').click();
    await expect(page.getByTestId('image-search-picker')).toBeVisible();

    // 検索を実行
    await page.getByTestId('image-search-keyword-input').fill('cat');
    await page.getByTestId('image-search-submit').click();

    // 結果が表示される
    const results = page.getByTestId('image-search-result');
    await expect(results).toHaveCount(2);

    // 1 枚目を選択
    await results.first().click();
    await expect(results.first()).toHaveAttribute('aria-pressed', 'true');

    // 登録ボタンが有効化される
    const registerButton = page.getByTestId('image-search-register-submit');
    await expect(registerButton).toBeEnabled();
    await registerButton.click();

    // 登録成功で / へ戻る
    await expect(page).toHaveURL(/\/$/);
  });

  test('キーワード未入力では検索バリデーションエラーが表示される', async ({ page }) => {
    await page.goto('/images/new');
    await page.getByTestId('image-register-tab-search').click();
    await page.getByTestId('image-search-submit').click();
    await expect(page.getByTestId('image-search-error')).toBeVisible();
  });

  test('検索 API が 503 を返したら混雑メッセージを表示する', async ({ page }) => {
    // テスト固有のルートで上書き
    await page.route(SEARCH_API, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'rate limited' }),
      });
    });

    await page.goto('/images/new');
    await page.getByTestId('image-register-tab-search').click();
    await page.getByTestId('image-search-keyword-input').fill('cat');
    await page.getByTestId('image-search-submit').click();

    await expect(page.getByTestId('image-search-error')).toContainText('混雑');
  });

  test('検索結果 0 件のときは empty state が表示される', async ({ page }) => {
    await page.route(SEARCH_API, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          page: 1,
          hasNextPage: false,
          provider: 'pexels',
        }),
      });
    });

    await page.goto('/images/new');
    await page.getByTestId('image-register-tab-search').click();
    await page.getByTestId('image-search-keyword-input').fill('zzz-no-hit');
    await page.getByTestId('image-search-submit').click();

    await expect(page.getByTestId('image-search-empty')).toBeVisible();
  });
});
