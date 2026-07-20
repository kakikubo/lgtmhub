-- Issue #274: user_profiles の is_admin 自己昇格を防ぐ。
--
-- 既存の RLS ポリシー ("users can update own profile" / "users can insert own profile") は
-- 「どの行に触れるか」(auth.uid() = id) だけを制限し、「どのカラムに触れるか」は制限しない。
-- Supabase はデフォルトで anon / authenticated ロールにテーブル全体の INSERT / UPDATE 権限を
-- 付与するため、認証ユーザーが PostgREST 経由で自分の行の is_admin = true を直接書き込め、
-- 権限昇格が成立してしまう。
--
-- 対策として、テーブル全体の INSERT / UPDATE 権限を剥奪し、アプリが実際に書き込むカラムだけを
-- カラム単位で GRANT し直す。RLS = 行、GRANT = 列 の二層で防御する。
-- is_admin の書き込みは handle_new_user トリガ (security definer / デフォルト false) と
-- 管理者付与マイグレーション・service_role 経由に限定され、authenticated からは触れなくなる。

-- anon は RLS (auth.uid() = id) で書き込み不可だが、テーブル権限自体も最小化しておく。
revoke insert, update on table public.user_profiles from anon, authenticated;

-- アプリからの更新は UserProfileRepository.updateAuthFields による
-- display_name / avatar_url の差分同期のみ。updated_at は set_updated_at トリガが代入するため
-- UPDATE 文で明示指定されず、カラム GRANT に含める必要はない。
grant update (display_name, avatar_url) on table public.user_profiles to authenticated;

-- 通常の行作成は handle_new_user トリガ (security definer) が担うが、既存の
-- "users can insert own profile" ポリシーの意図 (本人が自分の行を作成可) を保ちつつ
-- is_admin だけを除外する。
grant insert (id, github_login, display_name, avatar_url) on table public.user_profiles to authenticated;
