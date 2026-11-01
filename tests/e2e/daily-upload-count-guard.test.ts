import { expect, test } from '@playwright/test';
import { signedInClient } from './fixtures/supabase-clients';

// 日次登録カウンタの増減はサーバー専用 RPC に限られ、ログインユーザーの JWT で
// PostgREST を直接叩いても実行できないことを確認する。ブラウザ操作は不要なので
// page を使わず Supabase クライアントだけで検証する。

const OTHER_USER_ID = '5eed0000-0000-4000-8000-0000000000ff';
const TODAY = new Date().toISOString().slice(0, 10);

test.describe('日次登録カウンタ RPC の直接実行拒否', () => {
  test('authenticated ロールは increment_daily_upload_count を実行できない', async () => {
    const { supabase, userId } = await signedInClient();

    for (const target of [userId, OTHER_USER_ID]) {
      const { error } = await supabase.rpc('increment_daily_upload_count', {
        p_user_id: target,
        p_date: TODAY,
        p_max: 1000,
      });
      expect(error?.code).toBe('42501');
    }
  });

  test('authenticated ロールは release_daily_upload_count を実行できない', async () => {
    const { supabase, userId } = await signedInClient();

    const { error } = await supabase.rpc('release_daily_upload_count', {
      p_user_id: userId,
      p_date: TODAY,
    });
    expect(error?.code).toBe('42501');
  });
});
