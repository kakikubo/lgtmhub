# 要求内容

## 概要

GitHub OAuth ログイン時に、`user_profiles` の `avatar_url` / `display_name` を GitHub 側の最新値へ差分同期する仕組みを実装する（Issue #11）。

## 背景

現在の `auth.users` INSERT トリガ（`handle_new_user`）は**初回サインアップ時のみ**発火して `user_profiles` を作成する（`on conflict (id) do nothing`）。そのため、ユーザーが GitHub 側でアバター画像や表示名を変更しても `user_profiles` に反映されない。この差分をログインのたびに解消する。

実装方針は Issue の**案A（アプリ層で完結）**を採用する:
- `UserProfileService.syncFromAuth(userId, meta)` を新設し、`/api/auth/callback` の OAuth コールバック内から呼び出す
- `auth.users.raw_user_meta_data`（= `user.user_metadata`）から最新値を読み、`user_profiles` を UPDATE する

案B（`auth.users` への UPDATE トリガ追加）は、`auth` スキーマへのトリガ追加が CLI サポートに依存するため採用しない。

## 実装対象の機能

### 1. UserProfileRepository への更新メソッド追加
- `user_profiles` の該当行を部分更新する書き込みメソッドを追加する
- 既存の `image-repository.ts` の書き込みパターン（`insert/update` → `select('*').single()` → `DatabaseError`）を踏襲する

### 2. UserProfileService.syncFromAuth の実装
- `user.user_metadata`（unknown）から `avatar_url` / `display_name` を型ガードで安全に抽出する
- `display_name` は `handle_new_user` と同じ優先順位（`full_name → name → user_name`）で導出する
- 抽出できた値のみを部分更新し、更新対象が無い場合はリポジトリを呼ばず早期リターンする

### 3. OAuth コールバックからの呼び出し
- `exchangeCodeForSession` 成功後に `supabase.auth.getUser()` でユーザーを取得し、`buildUserProfileService(supabase).syncFromAuth(...)` を呼ぶ
- 同期失敗がログイン自体を壊さないよう try/catch で握りつぶす（リダイレクトは必ず返す）

### 4. ユニットテスト
- サービス層: リポジトリをモックし、`display_name` の coalesce 導出・更新対象無し時の早期リターン・リポジトリ呼び出し引数を検証
- リポジトリ層: Supabase チェーンをモックし、`from('user_profiles')` / update ペイロード / エラー時 `DatabaseError` を検証

## 受け入れ条件

### 差分同期
- [ ] `UserProfileService.syncFromAuth(userId, meta)` が実装されている
- [ ] `avatar_url` が変わっていれば `user_profiles.avatar_url` が更新される
- [ ] `display_name` が `full_name → name → user_name` の優先順位で導出・更新される
- [ ] `user_metadata` に該当キーが無い場合、その項目は上書きされない（部分更新）
- [ ] 更新対象が1件も無い場合はリポジトリを呼ばない

### コールバック連携
- [ ] `/api/auth/callback` が exchange 成功後に `syncFromAuth` を呼ぶ
- [ ] `syncFromAuth` が失敗してもログイン（リダイレクト）は成功する

### 品質
- [ ] サービス層・リポジトリ層のユニットテストが追加され、全テストが通る
- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` が通る
- [ ] `as` / `any` を使わず、`unknown` + 型ガードで絞り込んでいる

## 成功指標

- GitHub 側でアバター/表示名を変更した後にログインすると、`user_profiles` が最新値に更新される
- 既存のログインフロー（cookie 書き込み・リダイレクト）に副作用が無い

## スコープ外

以下はこのフェーズでは実装しません:

- `github_login`（`user_name`）の同期（unique 制約があり、タイトルの主旨はアバター/表示名のため）
- `auth.users` への DB トリガ追加（案B）
- スキーマ変更（`avatar_url` / `display_name` 列は既存のため不要）
- E2E テストの新規追加（既存 `tests/e2e/auth-callback.test.ts` の範囲で担保。必要なら別 Issue）

## 参照ドキュメント

- `docs/architecture.md` - レイヤー依存（app → services → repositories → lib）
- `docs/development-guidelines.md` - as/any 禁止、型ガード方針
- `app/api/CLAUDE.md` - route handler 規約（service 経由、エラー変換）
- `src/CLAUDE.md` - Supabase クライアント2種の使い分け、エラー方針
- Issue #11 / PR #2 / `.steering/20260503-github-oauth-auth/tasklist.md` 申し送り事項6
