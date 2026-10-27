-- リクエスト単位のレートリミット (Issue #275)。
-- 固定ウィンドウのカウンタを 1 キー 1 行で持つ。直接の読み書きはせず、
-- SECURITY DEFINER の RPC だけを service_role に許可する。
create table public.rate_limit_buckets (
  key text primary key,
  window_start timestamptz not null,
  count integer not null check (count >= 0)
);

alter table public.rate_limit_buckets enable row level security;

-- ポリシーは作らない。anon / authenticated からの直接アクセスを拒否する。
revoke all on table public.rate_limit_buckets from anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_now timestamptz := now();
begin
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 200 then
    raise exception 'invalid rate limit key' using errcode = '22023';
  end if;
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate limit window' using errcode = '22023';
  end if;

  insert into public.rate_limit_buckets (key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (key) do update
    set
      count = case
        when public.rate_limit_buckets.window_start + (p_window_seconds * interval '1 second') <= v_now
          then 1
        else public.rate_limit_buckets.count + 1
      end,
      window_start = case
        when public.rate_limit_buckets.window_start + (p_window_seconds * interval '1 second') <= v_now
          then v_now
        else public.rate_limit_buckets.window_start
      end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, integer) to service_role;

-- 日次登録の atomic increment を取得・合成より前に行うため、失敗時に枠を戻す。
-- 呼び出し元の JWT のユーザー以外は減算できない。
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
  if auth.uid() is distinct from p_user_id then
    raise exception 'forbidden' using errcode = '42501';
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

revoke all on function public.release_daily_upload_count(uuid, date) from public;
grant execute on function public.release_daily_upload_count(uuid, date) to authenticated;
