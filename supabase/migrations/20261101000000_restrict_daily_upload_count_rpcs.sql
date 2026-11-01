-- 日次登録カウンタの RPC をサーバー専用にする。
--
-- increment / release はどちらも引数で対象ユーザー・日付・上限を受け取る。authenticated に
-- 実行権限があると、アプリの登録フローを通らずに任意の引数でカウンタを増減できてしまう。
-- 実行権限は service_role にのみ付与し、引数はサーバーが検証済みの値 (セッションの
-- ユーザー ID・サーバー時計の日付・MAX_DAILY_UPLOADS) を渡す (consume_rate_limit と同じ型)。
-- SECURITY DEFINER は関数オーナー権限で動くため、service_role 自体のテーブル権限には依存しない。

-- 1 日のカウンタを atomic に「上限内のときだけ +1」する。
-- INSERT 競合時は ON CONFLICT で行ロックを取り、count < p_max のときのみ加算するため
-- 「件数を読んでチェック → +1」の TOCTOU レースを RPC 内で吸収する。
-- 上限超過時は SQLSTATE P0001 で 'daily_limit_exceeded' を raise する。
create or replace function public.increment_daily_upload_count(
  p_user_id uuid,
  p_date date,
  p_max integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  if p_user_id is null or p_date is null or p_max is null or p_max < 1 then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  insert into public.daily_upload_counts (user_id, date, count)
  values (p_user_id, p_date, 1)
  on conflict (user_id, date) do update
    set count = public.daily_upload_counts.count + 1
    where public.daily_upload_counts.count < p_max
  returning count into v_new_count;

  if v_new_count is null then
    -- 競合したが count < p_max を満たさず UPDATE がスキップされた = 上限到達
    raise exception 'daily_limit_exceeded' using errcode = 'P0001';
  end if;

  return v_new_count;
end;
$$;

revoke all on function public.increment_daily_upload_count(uuid, date, integer) from public, anon, authenticated;
grant execute on function public.increment_daily_upload_count(uuid, date, integer) to service_role;

-- increment で消費した 1 枠を戻す。取得・合成・DB 登録が失敗したときだけサーバーが呼ぶ。
-- service_role からの呼び出しでは auth.uid() が null になるため、本人確認はサーバー側
-- (requireUser で得たユーザー ID を渡す) で行う。
create or replace function public.release_daily_upload_count(
  p_user_id uuid,
  p_date date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count integer;
begin
  if p_user_id is null or p_date is null then
    raise exception 'invalid_argument' using errcode = '22023';
  end if;

  update public.daily_upload_counts
  set count = count - 1
  where user_id = p_user_id
    and date = p_date
    and count > 0
  returning count into v_new_count;

  return coalesce(v_new_count, 0);
end;
$$;

revoke all on function public.release_daily_upload_count(uuid, date) from public, anon, authenticated;
grant execute on function public.release_daily_upload_count(uuid, date) to service_role;
