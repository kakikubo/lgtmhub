import { expect, test } from '@playwright/test';

test.describe('画像一覧画面 (未ログイン)', () => {
  test('トップページに見出しと、画像グリッド / empty / error state のいずれかが表示される', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Make every LGTM count.' })).toBeVisible();

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

  // LCP 改善のため先頭カードには next/image の priority を付与している (image-grid.tsx)。
  // この属性が将来のリファクタで剥がれてもユーザー体験は壊れないが LCP が悪化するため、
  // DOM レベルで検出できるようにしておく
  test('画像がある場合、先頭カードの img に fetchpriority=high と loading=eager が付く', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    const firstImg = grid.locator('img').first();
    await expect(firstImg).toHaveAttribute('fetchpriority', 'high');
    await expect(firstImg).toHaveAttribute('loading', 'eager');
  });

  // Issue #63: ImageCard の <Link> に prefetch={false} を設定しているため、
  // 初回ロード時にカード分の RSC ペイロード (?_rsc=...) が自動プリフェッチされない。
  // この抑制が将来のリファクタで剥がれると初期ロードの帯域圧迫が再発するため、
  // ネットワークレベルで検出できるようにしておく
  test('画像がある場合、初回ロード時に詳細ページの RSC プリフェッチが発火しない', async ({
    page,
  }) => {
    const rscRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/images/') && url.includes('_rsc=')) {
        rscRequests.push(url);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle', timeout: 15_000 });

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    expect(rscRequests).toEqual([]);
  });
});
