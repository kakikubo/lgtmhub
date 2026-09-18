# 要求内容

## 概要

Issue #277 の修正。E2E 専用エンドポイント `/api/auth/test-signin` のガードを `E2E_TEST_MODE` 単独から多層防御にし、Vercel 本番で環境変数が誤混入しても GitHub OAuth を迂回できないようにする。

## 背景

`app/api/auth/test-signin/route.ts` は email/password で任意サインインできるエンドポイントで、保護は `process.env.E2E_TEST_MODE === 'true'` の 1 条件のみである。本番環境でこの環境変数が誤って設定・混入すると、GitHub OAuth を迂回した認証バイパスになる。

issue 本文は `NODE_ENV === 'production'` でも 403 にする案を含むが、CI e2e は Playwright の `webServer` で `pnpm start`（`NODE_ENV=production`）を使うため、これで弾くと e2e が壊れる。本番の判定には Vercel が本番デプロイ時だけ付与する `VERCEL_ENV` を使う。

## 実装対象の機能

### 1. test-signin の多層ガード
- `E2E_TEST_MODE === 'true'` でない場合は 403 を返す（既存）
- `VERCEL_ENV === 'production'` の場合は `E2E_TEST_MODE` に関わらず 403 を返す（追加）
- 判定はリクエスト時に `process.env` を読む（モジュールロード時評価にしない）

## 受け入れ条件

### test-signin の多層ガード
- [ ] `E2E_TEST_MODE` が `true` 以外なら 403
- [ ] `E2E_TEST_MODE=true` かつ `VERCEL_ENV=production` なら 403（`signInWithPassword` を呼ばない）
- [ ] `E2E_TEST_MODE=true` かつ `VERCEL_ENV=preview` なら既存どおり sign-in できる
- [ ] `E2E_TEST_MODE=true` かつ `NODE_ENV=production` かつ `VERCEL_ENV` 未設定なら既存どおり sign-in できる（CI `pnpm start` 相当）
- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` がすべて成功する

## 成功指標

- Vercel 本番で `E2E_TEST_MODE=true` が混入しても `/api/auth/test-signin` は 403 になる
- CI の e2e（`pnpm start` + `E2E_TEST_MODE=true`）は引き続き動く

## スコープ外

以下はこのフェーズでは実装しません:

- `NODE_ENV === 'production'` による 403（CI e2e が壊れるため）
- 本番ビルド成果物からの route 除外（App Router に標準手段がない）
- Vercel 本番環境変数の CI grep
- `proxy.ts` へのガード追加（`/api/auth/*` は matcher 対象外）

## 参照ドキュメント

- Issue #277
- `docs/development-guidelines.md` - E2E の storageState パターン
- `docs/architecture.md` - セキュリティアーキテクチャ
- `README.md` - ローカル E2E 手順
