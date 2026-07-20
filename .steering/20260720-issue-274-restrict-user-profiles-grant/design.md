# 設計書

## アーキテクチャ概要

RLS ポリシーは変更せず、PostgreSQL のカラム単位 GRANT で防御層を追加する。
「RLS = どの行に触れるか」「GRANT = どのカラムに触れるか」の役割分担とし、
既存のポリシー・アプリコードには一切手を入れない。

```
authenticated ユーザー (PostgREST / supabase-js)
  │
  ├─ UPDATE user_profiles
  │    ├─ GRANT:  display_name, avatar_url のみ許可  ← 今回追加
  │    └─ RLS:    auth.uid() = id の行のみ (既存のまま)
  │
  └─ INSERT user_profiles
       ├─ GRANT:  id, github_login, display_name, avatar_url のみ許可  ← 今回追加
       └─ RLS:    auth.uid() = id の行のみ (既存のまま)

is_admin の書き込み経路 (変更なし):
  - handle_new_user トリガ … security definer (postgres 権限) で INSERT、is_admin はデフォルト false
  - 管理者付与 … マイグレーション (例: bootstrap_admin_kakikubo) / service_role のみ
```

## コンポーネント設計

### 1. マイグレーション `20260720000000_restrict_user_profiles_column_grants.sql`

**責務**:
- `anon` / `authenticated` から `public.user_profiles` のテーブル全体 UPDATE / INSERT 権限を REVOKE する
- `authenticated` にカラム単位で GRANT し直す

**実装の要点**:
- `revoke insert, update on table public.user_profiles from anon, authenticated;`
- `grant update (display_name, avatar_url) on table public.user_profiles to authenticated;`
- `grant insert (id, github_login, display_name, avatar_url) on table public.user_profiles to authenticated;`
- `anon` には GRANT を戻さない(RLS でも弾かれるが、権限自体を残さない)
- `updated_at` は `set_updated_at` トリガが代入するため、カラム GRANT に含めなくてよい
  (カラム権限チェックは UPDATE 文で明示的に指定したカラムに対してのみ行われる)
- SELECT 権限には触れない(`anyone can view user_profiles` ポリシーの前提を維持)

### 2. アプリコード

**責務**: 変更なし

**実装の要点**:
- 書き込みは `UserProfileRepository.updateAuthFields` (`display_name` / `avatar_url` の部分更新) のみで、GRANT の範囲内
- `github_login` を UPDATE するコードは存在しない(UPDATE の GRANT からは除外する)
- `src/types/database.types.ts` は GRANT の影響を受けないため再生成しても差分なし(確認のみ行う)

## データフロー

### 権限昇格の再現と修正の検証 (ローカル Supabase)
```
1. (before) 現行マイグレーションのローカル DB で、テスト用 auth.users 行を作成
   → handle_new_user トリガで user_profiles 行が自動作成される
2. (before) role authenticated + request.jwt.claims の sub をそのユーザーに設定し
   `update user_profiles set is_admin = true` → 成功してしまうことを確認(脆弱性の再現)
3. 新マイグレーションを適用 (supabase migration up)
4. (after) 同じ UPDATE → permission denied になることを確認
5. (after) `update user_profiles set display_name = ...` → 成功することを確認
6. (after) `insert ... (is_admin)` → permission denied になることを確認
7. テストデータを削除
```

## エラーハンドリング

- カラム権限違反時、PostgREST はエラー(42501 permission denied)を返す。
  アプリの正常系は GRANT の範囲内なので、新たなエラーハンドリングは不要。

## セキュリティ考慮

- 本番への適用は既存の CI (supabase-deploy / supabase-preview-migrate) が
  `supabase db push` で行う。マイグレーションは冪等ではないが 1 回のみ適用される前提
- 万一将来 `is_admin` をアプリから更新する要件が出た場合は service_role +
  サーバーサイド専用経路で実装する(このマイグレーションの GRANT は広げない)
