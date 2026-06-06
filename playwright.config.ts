import { defineConfig, devices } from '@playwright/test';
import { STORAGE_STATE_PATH } from './tests/e2e/global-setup';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // ログイン済み storageState を生成する。webServer 起動 → globalSetup → 各 project の順で動く。
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      // 認証必須のテストはここでは動かさず、authenticated プロジェクトに任せる
      testIgnore: /auth-callback\.test\.ts/,
    },
    {
      name: 'authenticated',
      use: {
        ...devices['Desktop Chrome'],
        storageState: STORAGE_STATE_PATH,
      },
      // 認証済み前提のシナリオだけをこのプロジェクトで実行する
      testMatch: /auth-callback\.test\.ts/,
    },
  ],
  webServer: {
    command: process.env.CI ? 'pnpm run start' : 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    env: {
      // process.env は Playwright が自動でマージするので追加分のみ列挙する。
      // /api/auth/test-signin を有効化するために必要 (本番では未設定)
      E2E_TEST_MODE: 'true',
    },
  },
});
