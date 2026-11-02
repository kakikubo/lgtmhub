import { expect, test } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { serviceRoleClient, signedInClient } from './fixtures/supabase-clients';

// このファイルは playwright.config.ts の `authenticated` プロジェクトでのみ実行され、
// globalSetup が生成した storageState (ログイン済み cookie) を読み込んだ状態で動く。
//
// お気に入りの登録 → 一覧表示 → 解除は「画像が 1 枚以上ある」ことが前提だが、
// CI の Supabase Local はデータ空で起動する。外部 URL 取得を伴う画像登録 API (POST /api/images) は
// e2e から叩けないため、アプリと同じ service_role 専用 RPC (create_lgtm_image) で
// テストユーザーを uploader とするフィクスチャを投入する。
// anon / authenticated には lgtm_images の書き込み権限が無い。

const FIXTURE_ORIGINAL_URL = 'https://example.com/e2e-favorites-fixture.png';
// public/ の実ファイルを相対パスで指す。next/image の remotePatterns 設定に依存せず、
// 画像の中身ではなく DOM の状態だけを検証するため何でもよい。
const FIXTURE_IMAGE_URL = '/default-avatar.svg';
// ダミー pHash (Issue #345)。
// この値は POST /api/images の重複判定 (src/services/image-service.ts の isDuplicate) で
// 必ず比較対象になるため、「固定値なら何でもよい」わけではない。
// * 長さは src/lib/image/calculate-phash.ts の PHASH_LENGTH (32*32 = 1024) と一致させる。
//   ズレると hammingDistance が throw し、登録 API が 500 になる
// * '1' の繰り返しは使わない。calculatePHash は `value >= avg` でビット化するため
//   単色画像の pHash が全ビット '1' になり、DUPLICATE_THRESHOLD (10) 以内に収まって
//   409 (重複) を誤爆させる
// * ブロック状のパターン ('0'×512 + '1'×512 など) も使わない。上下で明暗が分かれた画像の
//   pHash がまさにその形になるため、実画像と一致しうる
// 周期 4 の 0011 パターンなら、実画像 (単色 / 左右 2 分割 / 上下 2 分割) とも
// supabase/seed.sql のフィクスチャとも距離が 511 以上離れる (実測)。
const FIXTURE_P_HASH = '0011'.repeat(256);

/**
 * フィクスチャ画像を論理削除する (アプリの削除と同じ soft_delete_lgtm_image RPC)。
 * 対象の特定はテストユーザー自身の SELECT 権限 (owner can view own images) で行う。
 * 行そのものは次回 globalSetup のテストユーザー再作成時に cascade で消える。
 */
async function softDeleteFixtures(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from('lgtm_images')
    .select('id')
    .eq('uploader_id', userId)
    .eq('original_url', FIXTURE_ORIGINAL_URL)
    .eq('status', 'active');
  if (error) throw new Error(`[e2e:favorites] フィクスチャ検索失敗: ${error.message}`);

  const service = serviceRoleClient();
  for (const { id } of data) {
    const { error: rpcError } = await service.rpc('soft_delete_lgtm_image', {
      p_id: id,
      p_uploader_id: userId,
    });
    if (rpcError) throw new Error(`[e2e:favorites] フィクスチャ削除失敗: ${rpcError.message}`);
  }
}

// fullyParallel: true 下でもこのブロック内は宣言順に直列実行する。
// 「登録済み」「未登録」という共有 DB 状態を跨ぐテストが並行すると互いに干渉するため。
test.describe.configure({ mode: 'serial' });

test.describe('お気に入り (ログイン済み)', () => {
  let imageId: string;

  test.beforeAll(async () => {
    const { supabase, userId } = await signedInClient();
    // 前回の実行が残したフィクスチャがあれば先に落としてから入れ直す
    await softDeleteFixtures(supabase, userId);

    const { data, error } = await serviceRoleClient()
      .rpc('create_lgtm_image', {
        p_uploader_id: userId,
        p_original_url: FIXTURE_ORIGINAL_URL,
        p_image_url: FIXTURE_IMAGE_URL,
        p_p_hash: FIXTURE_P_HASH,
        p_width: 266,
        p_height: 199,
        p_file_size_bytes: 1024,
        p_mime_type: 'image/webp',
        p_is_animated: false,
      })
      .select('id')
      .single();

    if (error) throw new Error(`[e2e:favorites] フィクスチャ投入失敗: ${error.message}`);
    imageId = data.id;
  });

  test.afterAll(async () => {
    const { supabase, userId } = await signedInClient();
    await softDeleteFixtures(supabase, userId);
  });

  test('ヘッダーにお気に入りリンクが表示される', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('header-favorites-link')).toHaveAttribute('href', '/favorites');
  });

  test('詳細ページで登録 → /favorites に表示 → 解除でハートが輪郭に戻る', async ({ page }) => {
    // 1. 詳細ページのハートを押して登録する
    await page.goto(`/images/${imageId}`);
    const detailFavorite = page.getByTestId('favorite-button');
    await expect(detailFavorite).toHaveAttribute('data-favorite-state', 'off');

    // クリック直後に画面遷移すると in-flight の POST が中断されるため、
    // レスポンスの到着を待ってから次のステップへ進む
    const [createResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/favorites') && res.request().method() === 'POST',
      ),
      detailFavorite.click(),
    ]);
    expect(createResponse.status()).toBe(201);
    // オプティミスティック更新で塗りつぶしになり、失敗時のロールバック / トーストも起きない
    await expect(detailFavorite).toHaveAttribute('data-favorite-state', 'on');
    await expect(page.getByTestId('favorite-toast')).toHaveCount(0);

    // 2. お気に入り一覧に出ることを確認する
    await page.goto('/favorites');
    // Suspense のストリーミング中は解決済みコンテンツが一時的に本体の外側にも現れるため、
    // ページ本体 (favorites-page) の内側にスコープして一意に特定する
    const grid = page.getByTestId('favorites-page').getByTestId('favorites-grid');
    await expect(grid).toBeVisible();
    await expect(grid.getByTestId('image-card-link')).toHaveAttribute('href', `/images/${imageId}`);
    // 一覧描画時点で /api/favorites/ids も解決済みなのでハートは塗りつぶし
    const listFavorite = grid.getByTestId('favorite-button').first();
    await expect(listFavorite).toHaveAttribute('data-favorite-state', 'on');

    // 3. 解除するとハートが輪郭へ戻る
    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/favorites/') && res.request().method() === 'DELETE',
      ),
      listFavorite.click(),
    ]);
    expect(deleteResponse.status()).toBe(204);
    await expect(listFavorite).toHaveAttribute('data-favorite-state', 'off');
    await expect(page.getByTestId('favorite-toast')).toHaveCount(0);

    // 4. リロードすると一覧から消え、空状態になる
    await page.reload();
    await expect(page.getByTestId('favorites-page').getByTestId('favorites-empty')).toBeVisible();
  });

  test('お気に入りが無い状態では空状態メッセージが出る', async ({ page }) => {
    await page.goto('/favorites');

    await expect(page.getByTestId('favorites-page').getByTestId('favorites-empty')).toBeVisible();
    await expect(page.getByTestId('favorites-signin-prompt')).toHaveCount(0);
  });
});
