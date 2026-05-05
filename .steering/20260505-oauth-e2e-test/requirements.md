# 要求内容: OAuth コールバックの E2E テスト追加

## 背景

PR #2 で実装した GitHub OAuth コールバック (`app/api/auth/callback/route.ts`) は、未ログイン UI と `?auth_error=missing_code` / `?auth_error=exchange_failed` の redirect しか自動テストでカバーされていない。

`exchangeCodeForSession` 成功後の挙動 (ログイン済みヘッダー / 「画像を登録する」リンク / トップページ表示の切り替え) は手動 `curl` 程度の確認しか行われておらず、後続の P0 機能 (画像削除 / お気に入り) で「ログイン済み状態」を前提としたフロー UI を E2E で検証する土台が整っていない。

## やりたいこと

- Issue #7 の完了条件:
  1. アプローチを決定 (A. Playwright `storageState` 活用)
  2. ログイン済み状態のヘッダー / トップページの表示を E2E で検証
  3. CI で安定して green
- 既存 e2e ジョブ (`supabase start` 連携済み) を壊さず、`storageState` を CI 内で都度生成して利用する。
- 後続 PR (削除 / お気に入り / オーナー判定) で再利用できる「authenticated test fixture」を整備する。

## 今回扱うもの

- Playwright `globalSetup` でログイン済み状態の `storageState` を生成する仕組み。
- `authenticated` プロジェクトと `unauthenticated` プロジェクトの 2 系統に分割した `playwright.config.ts`。
- ログイン済み状態のヘッダー UI 表示を検証する `tests/e2e/auth-callback.test.ts`。
- ローカル / CI から `service_role` キーで Supabase Admin API を叩き、テストユーザーを idempotent に作成する仕組み。
- 上記を機能させるために必要な、E2E ビルド時のみ有効なテスト専用 sign-in エンドポイント。
- README / `docs/development-guidelines.md` への手順追加。

## 今回扱わないもの

- 本物の GitHub OAuth サーバーをモック化する統合テスト (Issue 内アプローチ B、ROI 低と判断済み)。
- ログイン済み導線の E2E カバレッジ拡張 (削除ボタン押下、お気に入り操作など) — 該当機能の PR で個別追加する。
- セッション期限切れ / refresh token rotation の E2E 検証。
- middleware の matcher 拡張やセッション更新まわりの仕様変更。
- `auth.users` トリガー (`handle_new_user`) の改修 — 既存仕様 (raw_user_meta_data の `user_name` を見る) のまま、admin API 経由で同形のメタデータを渡す。

## 完了条件

- 認証済み E2E テスト (`tests/e2e/auth-callback.test.ts`) が新規追加され、ヘッダーの表示名 / アバター / 「画像を登録する」リンク / 「ログアウト」ボタンが認証済みコンテキストで表示されることを assert している。
- 同テストで、トップページに未ログイン誘導 (「GitHub でログイン」「ログインして登録」) が**表示されない**ことを assert している。
- `playwright.config.ts` で `authenticated` / `unauthenticated` 2 プロジェクトに分かれており、既存の未ログインテストはすべて `unauthenticated` プロジェクトで通る。
- `globalSetup` でテストユーザーが冪等に作成され、`storageState` ファイルが生成される。`storageState` ファイル自体は `.gitignore` で除外する。
- `npm run test:e2e` がローカル (Supabase Local 起動済み) で全 green。
- CI の `e2e` ジョブが既存 + 追加テストすべて green。
- README にローカル実行時の必要環境変数 (`SUPABASE_SERVICE_ROLE_KEY`, `E2E_TEST_MODE`) が記載されている。
- `docs/development-guidelines.md` の E2E セクションに `storageState` パターンの方針が追記されている。
