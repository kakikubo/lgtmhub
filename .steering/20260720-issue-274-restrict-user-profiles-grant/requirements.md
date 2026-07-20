# 要求内容

## 概要

Issue #274 の修正。`user_profiles` テーブルの UPDATE / INSERT 権限をカラム単位に絞り、認証ユーザーが自分の行の `is_admin` を直接 UPDATE / INSERT して権限昇格することを防ぐ。

## 背景

`supabase/migrations/20260503000000_create_user_profiles.sql` の UPDATE ポリシー
`"users can update own profile"` は `using / with check (auth.uid() = id)` のみで、
**行は制限するがカラムは制限しない**。Supabase はデフォルトで `authenticated` ロールに
テーブル全体の UPDATE 権限を付与するため、認証済みユーザーが PostgREST 経由で
自分の行の `is_admin = true` を UPDATE でき、権限昇格が成立し得る。

`is_admin` は `requireAdmin`(`src/lib/auth/require-admin.ts`)と `lgtm_images` の
管理者向け RLS ポリシーが信頼の起点にしているカラムであり、昇格が成立すると
regenerate API・全画像閲覧などの管理者機能を奪取できる。

INSERT ポリシー `"users can insert own profile"` にも同種の穴がある
(プロフィール行が無い場合に `is_admin = true` で自分の行を作成できる)ため、
同じマイグレーションでカラムを絞る。

## 実装対象の機能

### 1. user_profiles のカラム単位 GRANT への絞り込みマイグレーション
- `anon` / `authenticated` からテーブル全体の UPDATE / INSERT 権限を REVOKE する
- `authenticated` に UPDATE は `display_name, avatar_url` のみ GRANT する
  (アプリの書き込みは `UserProfileRepository.updateAuthFields` のこの 2 カラムのみ)
- `authenticated` に INSERT は `id, github_login, display_name, avatar_url` のみ GRANT する
  (通常は `handle_new_user` トリガ (security definer) が行を作成するため、既存 RLS ポリシーの意図を保ちつつ `is_admin` だけ除外)

## 受け入れ条件

### カラム単位 GRANT への絞り込み
- [ ] 認証ユーザー(authenticated ロール)が自分の行の `is_admin` を UPDATE すると permission denied になる
- [ ] 認証ユーザーが `display_name` / `avatar_url` を UPDATE すると成功し、`updated_at` がトリガで更新される
- [ ] 認証ユーザーが `is_admin` を含む INSERT を実行すると permission denied になる
- [ ] 修正前のローカル DB で `is_admin` の自己昇格が再現することを確認済み(before/after 検証)
- [ ] `pnpm run db:types` で `src/types/database.types.ts` に差分が出ない(GRANT は型に影響しない)
- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` がすべて成功する

## 成功指標

- ローカル Supabase での権限昇格の再現手順が、マイグレーション適用後に permission denied で失敗する
- 既存のプロフィール差分同期(OAuth コールバック)の動作が変わらない

## スコープ外

以下はこのフェーズでは実装しません:

- レートリミット導入(Issue #275)
- 管理者付与の運用フロー(現状どおり `bootstrap_admin_kakikubo` マイグレーション / service_role 経由)
- user_profiles への DELETE 権限の整理(DELETE ポリシーが存在せず RLS で拒否されるため現状維持)
