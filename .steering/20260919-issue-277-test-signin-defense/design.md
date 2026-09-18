# 設計書

## アーキテクチャ概要

ガードは Route Handler 内のリクエスト時評価に閉じる。`proxy.ts` は `/api/auth/*` を matcher 対象外にしている（自前 cookie 書き込みのため）ので、第二層も同じ route に置く。

```
POST /api/auth/test-signin
  │
  ├─ E2E_TEST_MODE !== 'true'     → 403 forbidden
  ├─ VERCEL_ENV === 'production'  → 403 forbidden
  └─ それ以外                     → signInWithPassword
```

許可される環境:

- ローカル `pnpm dev` / CI `pnpm start`: `VERCEL_ENV` 未設定
- Vercel Preview: `VERCEL_ENV=preview`（将来 Preview で e2e を回す余地）

拒否される環境:

- Vercel Production: `VERCEL_ENV=production`（`E2E_TEST_MODE=true` でも拒否）

## コンポーネント設計

### 1. `app/api/auth/test-signin/route.ts`

**責務**:
- E2E 限定の email/password sign-in と session cookie 発行
- 多層ガードで本番からの認証バイパスを防ぐ

**実装の要点**:
- `isE2ETestMode()` を `isTestSigninEnabled()` に置き換え、両方の条件を関数内で評価する
- モジュールロード時に `process.env` を読まない（Vitest でケースごとに差し替えるため）
- 403 レスポンスは既存どおり `{ error: 'forbidden' }`

### 2. `tests/unit/api/auth-test-signin.test.ts`

**責務**:
- 既存ケースに加え、`VERCEL_ENV` の第二層を固定する

**実装の要点**:
- `beforeEach` で `E2E_TEST_MODE` と `VERCEL_ENV` をクリアする
- 既存の `as any` キャストは Issue #281 の対象なので触らない

## データフロー

### 許可されるリクエスト
```
1. POST /api/auth/test-signin
2. isTestSigninEnabled() が true
3. body を zod で検証
4. createServerClient + signInWithPassword
5. 200 { ok: true } + session cookie
```

### 拒否されるリクエスト
```
1. POST /api/auth/test-signin
2. E2E_TEST_MODE が true でない、または VERCEL_ENV が production
3. 403 { error: 'forbidden' }（signInWithPassword は呼ばない）
```

## エラーハンドリング戦略

既存の 403 / 400 / 401 を維持する。新しいエラー型は導入しない。

## テスト戦略

### ユニットテスト
- `E2E_TEST_MODE` 未設定 → 403（既存）
- `E2E_TEST_MODE=true` + `VERCEL_ENV=production` → 403
- `E2E_TEST_MODE=true` + `VERCEL_ENV=preview` → 200
- `E2E_TEST_MODE=true` + `NODE_ENV=production` + `VERCEL_ENV` 未設定 → 200
- body 不正 / sign-in 失敗は既存ケースのまま

### 統合テスト
- 追加しない。CI e2e が `pnpm start` + `E2E_TEST_MODE=true` で通ることを回帰として扱う

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
app/api/auth/test-signin/route.ts
tests/unit/api/auth-test-signin.test.ts
README.md
docs/development-guidelines.md
docs/architecture.md
.steering/20260919-issue-277-test-signin-defense/
```

## 実装の順序

1. ルートのガード関数を拡張する
2. unit テストを追加する
3. README / docs を更新する
4. `pnpm run check` / `typecheck` / `test` を実行する

## セキュリティ考慮事項

- `NODE_ENV` は本番判定に使わない。Next.js の `pnpm start` も `NODE_ENV=production` になる
- `VERCEL_ENV` は Vercel がデプロイ種別ごとに注入する。GitHub Actions / ローカルには付かない
- 本番ビルドから route ファイルを除外する手段は App Router に無く、ランタイムガードで足りる

## パフォーマンス考慮事項

リクエスト先頭の環境変数比較のみで、追加の I/O はない。

## 将来の拡張性

Preview で e2e を回す場合は `E2E_TEST_MODE=true` と `VERCEL_ENV=preview` の組み合わせがそのまま使える。
