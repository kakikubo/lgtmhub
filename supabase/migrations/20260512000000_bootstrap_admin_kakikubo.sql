-- 初期管理者として kakikubo を指定する。
-- user_profiles.is_admin を真実とする方針 (PRD 機能6 / functional-design.md 参照)。
-- マイグレーションは一度だけ適用されるため冪等性ガードは不要。
update public.user_profiles
set is_admin = true
where github_login = 'kakikubo';
