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

  // Issue #128: 投稿者情報は詳細ページに移動したため、一覧の各カードには投稿者行を出さない。
  // 過去の Issue #98/#102 で表示していた投稿者プロフィール行 (image-card-uploader) が
  // 復活していないことを DOM レベルで保証する。
  test('一覧のカードには投稿者プロフィール行が表示されない (Issue #128)', async ({ page }) => {
    await page.goto('/');

    const grid = page.getByTestId('image-grid');
    if (!(await grid.isVisible().catch(() => false))) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }

    await expect(grid.getByTestId('image-card-uploader')).toHaveCount(0);
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

// Issue #169: 一覧カードのコピーボタンを画像ホバーで現れるオーバーレイに変更し、
// 画像下部の常時表示ボタンを廃止した。
// データ有無に依存しないよう、grid 未表示 (empty / error) のときはスキップする既存パターンに倣う。
test.describe('一覧カードのホバーコピーボタン (Issue #169)', () => {
  // トップページは Suspense でストリーミングされるため、goto 直後は skeleton 段階で grid が
  // まだ出ていないことがある。grid/empty/error のいずれかが確定するまで待ってから判定する。
  async function gotoAndRequireGrid(page: import('@playwright/test').Page) {
    await page.goto('/');
    const grid = page.getByTestId('image-grid');
    const empty = page.getByTestId('image-list-empty');
    const error = page.getByTestId('image-list-error');
    await expect(grid.or(empty).or(error)).toBeVisible();
    if (!(await grid.isVisible())) {
      test.skip(true, 'グリッド未表示 (empty / error state) のため検証をスキップ');
    }
    return grid;
  }

  test('コピーボタンは通常非表示 (opacity=0) で、画像ホバーで表示 (opacity=1) される', async ({
    page,
  }) => {
    const grid = await gotoAndRequireGrid(page);

    const firstCard = grid.locator('li').first();
    const copyButton = firstCard.getByTestId('copy-markdown-button');

    // 非ホバー時は透明 (opacity-0)。Playwright の toBeVisible は opacity を見ないため
    // 計算済みスタイルで検証する。
    await expect(copyButton).toHaveCSS('opacity', '0');

    // 画像 (リンク領域) にホバーするとオーバーレイが現れる。
    await firstCard.getByTestId('image-card-link').hover();
    await expect(copyButton).toHaveCSS('opacity', '1');
  });

  test('画像リンクにキーボードフォーカスするとコピーボタンが表示される', async ({ page }) => {
    const grid = await gotoAndRequireGrid(page);

    const firstCard = grid.locator('li').first();
    // group-focus-within により、子の Link がフォーカスされた段階でオーバーレイが出現する。
    await firstCard.getByTestId('image-card-link').focus();
    await expect(firstCard.getByTestId('copy-markdown-button')).toHaveCSS('opacity', '1');
  });

  test('ホバーで現れたボタンを押すとコピー完了フィードバックが表示され、詳細へ遷移しない', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-write']);
    const grid = await gotoAndRequireGrid(page);

    const firstCard = grid.locator('li').first();
    await firstCard.getByTestId('image-card-link').hover();

    const copyButton = firstCard.getByTestId('copy-markdown-button');
    await copyButton.click();

    // コピー完了フィードバックが出る (= ボタンのクリックが成立している)。
    await expect(firstCard.getByTestId('copy-feedback')).toBeVisible();
    // ボタンクリックでリンク遷移していない (トップに留まる)。
    await expect(page).toHaveURL(/\/$/);
  });
});

// Issue #109: 一覧画面のランダム表示機能。
// seed 画像が無い環境でも安定するよう、grid/empty/error のいずれかが出ることだけを
// 保証する既存テストの耐性パターンに倣う。
test.describe('画像一覧画面 ランダム表示 (Issue #109)', () => {
  test('ページ先頭に「ランダム表示」ボタンが常時表示される', async ({ page }) => {
    await page.goto('/');

    const randomButton = page.getByTestId('random-button');
    await expect(randomButton).toBeVisible();
    await expect(randomButton).toHaveText('ランダム表示');
  });

  test('押下するとランダム表示に切り替わり、「もっと読み込む」が出ない', async ({ page }) => {
    await page.goto('/');

    const randomButton = page.getByTestId('random-button');
    await randomButton.click();

    // ランダム fetch 完了後、ボタン文言が通常へ戻る (loading 解除) のを待つ
    await expect(randomButton).toHaveText('ランダム表示');

    // モードがランダムへ切り替わったことを決定的に検証する
    await expect(page.getByTestId('home-images')).toHaveAttribute('data-mode', 'random');

    // ランダムモードでは grid (= 抽出結果) か empty (= 0 件) が表示される
    const grid = page.getByTestId('image-grid');
    const empty = page.getByTestId('image-list-empty');
    await expect(grid.or(empty)).toBeVisible();

    // ランダム表示中は「もっと読み込む」を出さない (受け入れ条件)
    await expect(page.getByTestId('load-more-button')).toHaveCount(0);
  });

  test('再押下してもクラッシュせず、引き続きランダム表示が成立する', async ({ page }) => {
    await page.goto('/');

    const randomButton = page.getByTestId('random-button');
    await randomButton.click();
    await expect(randomButton).toHaveText('ランダム表示');
    await randomButton.click();
    await expect(randomButton).toHaveText('ランダム表示');

    const grid = page.getByTestId('image-grid');
    const empty = page.getByTestId('image-list-empty');
    await expect(grid.or(empty)).toBeVisible();
    await expect(page.getByTestId('load-more-button')).toHaveCount(0);
  });

  test('リロードするとランダム状態が解除され通常表示へ戻る', async ({ page }) => {
    await page.goto('/');

    const randomButton = page.getByTestId('random-button');
    await randomButton.click();
    await expect(randomButton).toHaveText('ランダム表示');
    await expect(page.getByTestId('home-images')).toHaveAttribute('data-mode', 'random');

    await page.reload();

    // リロード後は SSR の通常表示。クライアント状態が破棄され mode=default へ戻ることを
    // 決定的に検証する (受け入れ条件: リロードで通常表示へ自動復帰)。
    await expect(page.getByTestId('home-images')).toHaveAttribute('data-mode', 'default');
    await expect(page.getByTestId('random-button')).toBeVisible();

    const grid = page.getByTestId('image-grid');
    const emptyState = page.getByTestId('image-list-empty');
    const errorState = page.getByTestId('image-list-error');
    await expect(grid.or(emptyState).or(errorState)).toBeVisible();
  });
});
