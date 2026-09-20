import { expect, test } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { TEST_USER_EMAIL, TEST_USER_PASSWORD } from './global-setup';

// このファイルは playwright.config.ts の `authenticated` プロジェクトでのみ実行され、
// globalSetup が生成した storageState (ログイン済み cookie) を読み込んだ状態で動く。
//
// お気に入りの登録 → 一覧表示 → 解除は「画像が 1 枚以上ある」ことが前提だが、
// CI の Supabase Local はデータ空で起動する。外部 URL 取得を伴う画像登録 API (POST /api/images) は
// e2e から叩けないため、テストユーザーとしてサインインした Supabase クライアントで
// lgtm_images に直接フィクスチャを投入する。
//
// service_role ではなく「サインイン済みの authenticated ロール」を使うのは、
// このプロジェクトの Supabase Local では service_role にテーブル権限が無く
// (PostgREST が 42501 permission denied を返す)、RLS ポリシー
// "authenticated users can insert own images" (auth.uid() = uploader_id) 経由なら
// 本番と同じ経路で書き込めるため。

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

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`[e2e:favorites] 環境変数 ${name} が未設定です`);
  return value;
}

/** テストユーザーとしてサインイン済みの Supabase クライアントを返す */
async function signedInClient(): Promise<{ supabase: SupabaseClient; userId: string }> {
  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
  });
  if (error || !data.user) {
    throw new Error(`[e2e:favorites] テストユーザーのサインインに失敗: ${error?.message}`);
  }
  return { supabase, userId: data.user.id };
}

/**
 * フィクスチャ画像を論理削除する。
 * lgtm_images に DELETE ポリシーは無く (アプリの削除も論理削除)、所有者の UPDATE のみ許可される。
 * 行そのものは次回 globalSetup のテストユーザー再作成時に cascade で消える。
 */
async function softDeleteFixtures(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase
    .from('lgtm_images')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('uploader_id', userId)
    .eq('original_url', FIXTURE_ORIGINAL_URL)
    .eq('status', 'active');
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

    const { data, error } = await supabase
      .from('lgtm_images')
      .insert({
        uploader_id: userId,
        original_url: FIXTURE_ORIGINAL_URL,
        image_url: FIXTURE_IMAGE_URL,
        p_hash: FIXTURE_P_HASH,
        width: 266,
        height: 199,
        file_size_bytes: 1024,
        mime_type: 'image/webp',
        is_animated: false,
        status: 'active',
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
