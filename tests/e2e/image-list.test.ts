import { expect, type Page, test } from '@playwright/test';
import { PRIORITY_IMAGE_COUNT, SEED_IMAGE_COUNT } from './fixtures/seed-images';

// Issue #279: 以前は「grid が出ていなければ test.skip()」というガードを各所に置いていたため、
// 画像 0 件の CI では全テストが何もアサートせずに緑になっていた (サイレント no-op)。
// supabase/seed.sql が決定的なフィクスチャを投入するようになったので、無条件にアサートする。

/**
 * トップページを開き、画像グリッドが出るまで待って返す。
 * トップページは Suspense でストリーミングされるため goto 直後は skeleton 段階で
 * grid が未表示のことがある。可視になるまで待ってから操作する。
 */
async function gotoAndGetGrid(page: Page) {
  await page.goto('/');
  const grid = page.getByTestId('image-grid');
  await expect(grid).toBeVisible();
  return grid;
}

test.describe('画像一覧画面 (未ログイン)', () => {
  test('トップページに見出しと画像グリッドが表示される', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Make every LGTM count.' })).toBeVisible();

    const grid = page.getByTestId('image-grid');
    await expect(grid).toBeVisible();
    // 空状態 / エラー状態は出ない (シードデータが必ずある)
    await expect(page.getByTestId('image-list-empty')).toHaveCount(0);
    await expect(page.getByTestId('image-list-error')).toHaveCount(0);
    // ローカル DB には開発中に登録した画像が混ざり得るため下限で見る。
    // ストリーミング途中でカードが出揃っていないことがあるので expect.poll でリトライする
    await expect.poll(() => grid.locator('li').count()).toBeGreaterThanOrEqual(SEED_IMAGE_COUNT);
  });

  test('未ログイン誘導 (「ログインして登録」) が表示される', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'ログインして登録' })).toBeVisible();
  });

  // LCP 改善のため先頭 4 枚には next/image の priority を付与している (image-grid.tsx)。
  // この属性が将来のリファクタで剥がれてもユーザー体験は壊れないが LCP が悪化するため、
  // DOM レベルで検出できるようにしておく。
  //
  // Next.js 16 の next/image は priority を fetchpriority="high" / loading="eager" 属性には
  // 変換しない (shared/lib/get-img-props.js)。実際の挙動は
  //   - priority の画像は loading 属性そのものが出ない (非 priority は loading="lazy")
  //   - App Router では ReactDOM.preload により <head> に
  //     <link rel="preload" as="image"> が出る
  // であり、この 2 点で priority の有無を判定する。
  test('先頭カードは preload され、priority 対象外のカードは遅延読み込みになる', async ({
    page,
  }) => {
    const grid = await gotoAndGetGrid(page);

    const firstImg = grid.locator('li').first().locator('img');
    // 否定アサートは「要素が無い」場合も pass するため、先に存在を確定させる
    await expect(firstImg).toBeVisible();
    await expect(firstImg).not.toHaveAttribute('loading', /.*/);

    const firstSrc = await firstImg.getAttribute('src');
    expect(firstSrc).toBeTruthy();
    // href をセレクタに埋め込むと URL 内の引用符でセレクタが壊れるため、列挙して比較する
    await expect
      .poll(() =>
        page
          .locator('link[rel="preload"][as="image"]')
          .evaluateAll((links) => links.map((link) => link.getAttribute('href'))),
      )
      .toContain(firstSrc);

    // PRIORITY_IMAGE_COUNT 枚目より後ろは lazy のまま (= priority が広がっていない)
    const lazyImg = grid.locator('li').nth(PRIORITY_IMAGE_COUNT).locator('img');
    await expect(lazyImg).toHaveAttribute('loading', 'lazy');
  });

  // Issue #128: 投稿者情報は詳細ページに移動したため、一覧の各カードには投稿者行を出さない。
  // 過去の Issue #98/#102 で表示していた投稿者プロフィール行 (image-card-uploader) が
  // 復活していないことを DOM レベルで保証する。
  test('一覧のカードには投稿者プロフィール行が表示されない (Issue #128)', async ({ page }) => {
    const grid = await gotoAndGetGrid(page);

    await expect(grid.getByTestId('image-card-uploader')).toHaveCount(0);
  });

  // Issue #63: ImageCard の <Link> に prefetch={false} を設定しているため、
  // 初回ロード時にカード分の RSC ペイロード (?_rsc=...) が自動プリフェッチされない。
  // この抑制が将来のリファクタで剥がれると初期ロードの帯域圧迫が再発するため、
  // ネットワークレベルで検出できるようにしておく
  test('初回ロード時に詳細ページの RSC プリフェッチが発火しない', async ({ page }) => {
    const rscRequests: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/images/') && url.includes('_rsc=')) {
        rscRequests.push(url);
      }
    });

    await page.goto('/', { waitUntil: 'networkidle', timeout: 15_000 });
    await expect(page.getByTestId('image-grid')).toBeVisible();

    expect(rscRequests).toEqual([]);
  });
});

// Issue #169: 一覧カードのコピーボタンを画像ホバーで現れるオーバーレイに変更し、
// 画像下部の常時表示ボタンを廃止した。
test.describe('一覧カードのホバーコピーボタン (Issue #169)', () => {
  test('コピーボタンは通常非表示 (opacity=0) で、画像ホバーで表示 (opacity=1) される', async ({
    page,
  }) => {
    const grid = await gotoAndGetGrid(page);

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
    const grid = await gotoAndGetGrid(page);

    const firstCard = grid.locator('li').first();
    // group-has-[:focus-visible] により、子の Link がキーボードフォーカスされた段階でオーバーレイが出現する。
    await firstCard.getByTestId('image-card-link').focus();
    await expect(firstCard.getByTestId('copy-markdown-button')).toHaveCSS('opacity', '1');
  });

  test('ホバーで現れたアイコンボタンを押すとコピー完了状態になり、詳細へ遷移しない', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-write']);
    const grid = await gotoAndGetGrid(page);

    const firstCard = grid.locator('li').first();
    await firstCard.getByTestId('image-card-link').hover();

    const copyButton = firstCard.getByTestId('copy-markdown-button');
    await copyButton.click();

    // アイコン化に伴い表示テキストではなく data-copy-state でコピー完了を判定する (Issue #174)。
    await expect(copyButton).toHaveAttribute('data-copy-state', 'copied');
    // ボタンクリックでリンク遷移していない (トップに留まる)。
    await expect(page).toHaveURL(/\/$/);
  });

  // マウスでコピーボタンを押すと :focus が残るため、group-focus-within ではホバーを
  // 外してもオーバーレイが消えなかった不具合の回帰テスト。group-has-[:focus-visible] へ
  // 変更したことで、マウスクリック後にホバーが外れたら確実に opacity-0 へ戻る。
  test('コピーボタンをクリック後、ホバーを外すとボタンは非表示 (opacity=0) へ戻る', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-write']);
    const grid = await gotoAndGetGrid(page);

    const firstCard = grid.locator('li').first();
    await firstCard.getByTestId('image-card-link').hover();

    const copyButton = firstCard.getByTestId('copy-markdown-button');
    await copyButton.click();
    await expect(copyButton).toHaveCSS('opacity', '1');

    // ホバーをカードの外へ移す (見出し付近)。マウス操作由来の :focus は :focus-visible を
    // 立てないため、ホバーが外れた時点でオーバーレイは消える。
    await page.getByRole('heading', { name: 'Make every LGTM count.' }).hover();
    await expect(copyButton).toHaveCSS('opacity', '0');
  });
});

// Issue #109: 一覧画面のランダム表示機能。
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

    // シードデータがあるのでランダムモードでも必ず抽出結果が出る
    await expect(page.getByTestId('image-grid')).toBeVisible();

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

    await expect(page.getByTestId('image-grid')).toBeVisible();
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
    await expect(page.getByTestId('image-grid')).toBeVisible();
  });
});

// Issue #279: 0 件表示はデータ有無に左右される skip ではなく、
// 明示的に空状態を作るテストとして分離する。
// (SSR の初期一覧はシードデータで必ず埋まるため、クライアント fetch である
//  ランダム表示 API をモックして 0 件応答を作る)
test.describe('画像一覧画面 空状態 (Issue #279)', () => {
  test('ランダム表示の結果が 0 件なら空状態メッセージが出る', async ({ page }) => {
    await page.route('**/api/images/random', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ images: [] }),
      }),
    );

    await page.goto('/');
    await expect(page.getByTestId('image-grid')).toBeVisible();

    await page.getByTestId('random-button').click();

    await expect(page.getByTestId('home-images')).toHaveAttribute('data-mode', 'random');
    await expect(page.getByTestId('image-list-empty')).toBeVisible();
    await expect(page.getByTestId('image-grid')).toHaveCount(0);
  });
});
