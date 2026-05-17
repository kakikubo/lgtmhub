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

  // Issue #98: 画像カードに投稿者プロフィール (アバター + 表示名) を表示する。
  // プロフィール行が無い場合のフォールバック (Unknown + デフォルトアバター) も含めて
  // すべてのカードが投稿者行を持つ。
  test('画像がある場合、各カードに投稿者プロフィール行が表示される', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    const cardCount = await grid.locator('li').count();
    const uploaderRows = grid.getByTestId('image-card-uploader');
    await expect(uploaderRows).toHaveCount(cardCount);
    // 投稿者名は非表示。アバター画像のみが描画されていることを確認
    await expect(uploaderRows.first().locator('img')).toHaveAttribute('src', /.+/);
  });

  // Issue #102: 投稿者プロフィールが取得できたカードでは、アバターのブロックが
  // GitHub プロフィールページへの新規タブリンクになっている。fallback (Unknown) カードは
  // リンクにならず <div> のまま。
  test('投稿者プロフィール行は profile 有のとき新規タブで GitHub プロフィールへ遷移するリンクになっている', async ({
    page,
  }) => {
    await page.goto('/');

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    const linkedRow = grid.locator('[data-testid="image-card-uploader"][data-fallback="false"]');
    const linkedCount = await linkedRow.count();
    if (linkedCount === 0) {
      test.skip(true, 'profile 取得済みカードが無いため検証をスキップ');
    }

    const firstLinked = linkedRow.first();
    await expect(firstLinked).toHaveJSProperty('tagName', 'A');

    const href = await firstLinked.getAttribute('href');
    expect(href).toMatch(/^https:\/\/github\.com\/.+/);

    await expect(firstLinked).toHaveAttribute('target', '_blank');
    const rel = (await firstLinked.getAttribute('rel')) ?? '';
    expect(rel).toContain('noopener');
    expect(rel).toContain('noreferrer');

    const ariaLabel = (await firstLinked.getAttribute('aria-label')) ?? '';
    expect(ariaLabel).toMatch(/^.+ の GitHub プロフィール$/);
  });

  // Issue #102: fallback カード (profile 未取得) は <a> ではなく <div> のままで、
  // GitHub プロフィールへ飛ばないことを保証する。
  test('fallback カード (profile 未取得) の投稿者行はリンクにならない', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    const fallbackRow = grid.locator('[data-testid="image-card-uploader"][data-fallback="true"]');
    const fallbackCount = await fallbackRow.count();
    if (fallbackCount === 0) {
      test.skip(true, 'fallback カードが無いため検証をスキップ');
    }

    await expect(fallbackRow.first()).toHaveJSProperty('tagName', 'DIV');
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
