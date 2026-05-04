-- daily_upload_counts: 1 日の画像登録数を atomic にカウントする
create table public.daily_upload_counts (
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  date date not null,
  count integer not null default 0 check (count >= 0),
  primary key (user_id, date)
);

-- RLS
alter table public.daily_upload_counts enable row level security;

create policy "users can view own daily upload counts"
  on public.daily_upload_counts
  for select
  using (auth.uid() = user_id);

-- INSERT/UPDATE は SECURITY DEFINER の RPC 経由でのみ行うため、
-- 通常クライアントからの直接書き込みは禁止する (= ポリシーを定義しない)。

-- 1 日のカウンタを atomic に「上限内のときだけ +1」する。
-- INSERT 競合時は ON CONFLICT で行ロックを取り、count < p_max のときのみ加算するため
-- 「getCount でチェック → increment」の TOCTOU レースを RPC 内で吸収する。
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

-- 認証済みユーザーが自分の値だけを増やせるよう、関数の実行権限を絞る
revoke all on function public.increment_daily_upload_count(uuid, date, integer) from public;
grant execute on function public.increment_daily_upload_count(uuid, date, integer) to authenticated;
