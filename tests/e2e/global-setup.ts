import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { request as playwrightRequest } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// E2E ジョブで必要なテストユーザーを idempotent に作り、ログイン済みの storageState ファイルを生成する。
// GitHub OAuth 本番フロー全体は外部 IDP に依存するため自動化困難だが、
// 「callback で session cookie が立った後の UI」だけは email/password sign-in で同じ cookie を立てて再現できる。

const TEST_USER_EMAIL = 'e2e-user@example.com';
const TEST_USER_PASSWORD = 'e2e-password-1234!';
const TEST_USER_METADATA = {
  user_name: 'e2e-test-user',
  full_name: 'E2E Test User',
  avatar_url: 'https://avatars.githubusercontent.com/u/0?v=4',
};

const STORAGE_STATE_PATH = path.resolve(
  process.cwd(),
  'tests/e2e/.auth/authenticated-user.json',
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[e2e:global-setup] 環境変数 ${name} が未設定です。Supabase Local 起動後に supabase status の値を .env.local もしくは shell に設定してください。`,
    );
  }
  return value;
}

async function ensureTestUser(adminUrl: string, serviceRoleKey: string): Promise<void> {
  const admin = createClient(adminUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 既存テストユーザーを毎回削除して再作成する (前回の `user_metadata` 差分を引きずらない)
  // perPage の既定 50 だと、CI 以外でユーザーが膨らんだ環境でテストユーザーを取りこぼす可能性があるので大きめに固定する
  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    throw new Error(`[e2e:global-setup] listUsers 失敗: ${listError.message}`);
  }
  const existing = list.users.find((u) => u.email === TEST_USER_EMAIL);
  if (existing) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(existing.id);
    if (deleteError) {
      throw new Error(`[e2e:global-setup] deleteUser 失敗: ${deleteError.message}`);
    }
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: TEST_USER_PASSWORD,
    email_confirm: true,
    user_metadata: TEST_USER_METADATA,
  });
  if (createError) {
    throw new Error(`[e2e:global-setup] createUser 失敗: ${createError.message}`);
  }
}

async function captureStorageState(baseURL: string): Promise<void> {
  await mkdir(path.dirname(STORAGE_STATE_PATH), { recursive: true });

  const apiContext = await playwrightRequest.newContext({ baseURL });
  try {
    const response = await apiContext.post('/api/auth/test-signin', {
      data: { email: TEST_USER_EMAIL, password: TEST_USER_PASSWORD },
    });
    if (!response.ok()) {
      const body = await response.text();
      throw new Error(
        `[e2e:global-setup] /api/auth/test-signin 失敗 (status=${response.status()}, body=${body}). webServer に E2E_TEST_MODE=true が渡っているか確認してください。`,
      );
    }

    await apiContext.storageState({ path: STORAGE_STATE_PATH });
  } finally {
    await apiContext.dispose();
  }
}

export default async function globalSetup(): Promise<void> {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  // anon key は test-signin 経由では使われないが、未設定なら webServer も起動しないので fail-fast で揃える
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  await ensureTestUser(supabaseUrl, serviceRoleKey);
  await captureStorageState(baseURL);
}

export { STORAGE_STATE_PATH };
