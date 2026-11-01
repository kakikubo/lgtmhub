import { expect, test } from '@playwright/test';
import { SEED_IMAGES } from './fixtures/seed-images';
import { signedInClient } from './fixtures/supabase-clients';

// lgtm_images への書き込みはサーバー専用 RPC に限られ、ログインユーザーの JWT で
// PostgREST を直接叩いても書き込めないことを確認する。ブラウザ操作は不要なので
// page を使わず Supabase クライアントだけで検証する。

test.describe('lgtm_images の直接書き込み拒否', () => {
  test('authenticated ロールは lgtm_images に INSERT できない', async () => {
    const { supabase, userId } = await signedInClient();

    const { error } = await supabase.from('lgtm_images').insert({
      uploader_id: userId,
      original_url: 'https://example.com/e2e-write-guard.png',
      image_url: 'https://example.com/e2e-write-guard.webp',
      p_hash: '0101'.repeat(256),
      width: 1,
      height: 1,
      file_size_bytes: 1,
      mime_type: 'image/webp',
      is_animated: false,
      status: 'active',
    });

    expect(error?.code).toBe('42501');
  });

  test('authenticated ロールは lgtm_images を UPDATE できない', async () => {
    const { supabase } = await signedInClient();

    const { error } = await supabase
      .from('lgtm_images')
      .update({ created_at: '2999-01-01T00:00:00.000Z' })
      .eq('id', SEED_IMAGES[0].id);

    expect(error?.code).toBe('42501');
  });

  test('authenticated ロールは書き込み RPC を実行できない', async () => {
    const { supabase, userId } = await signedInClient();

    const { error } = await supabase.rpc('soft_delete_lgtm_image', {
      p_id: SEED_IMAGES[0].id,
      p_uploader_id: userId,
    });

    expect(error?.code).toBe('42501');
  });
});
