-- user_profiles: Supabase Auth と 1:1 で対応するアプリ側プロフィール
create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  github_login text not null unique,
  display_name text not null,
  avatar_url text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_profiles_github_login_idx on public.user_profiles (github_login);

-- updated_at を行更新時に自動で詰める
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- auth.users 作成時に user_profiles を初回作成（GitHub OAuth でサインアップした場合のみ）
-- security definer: public.user_profiles に書き込むため auth.users 側 (postgres) の権限で実行する
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_github_login text;
  v_display_name text;
  v_avatar_url   text;
begin
  v_github_login := new.raw_user_meta_data ->> 'user_name';
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    v_github_login
  );
  v_avatar_url := coalesce(new.raw_user_meta_data ->> 'avatar_url', '');

  if v_github_login is null then
    return new;
  end if;

  insert into public.user_profiles (id, github_login, display_name, avatar_url)
  values (new.id, v_github_login, v_display_name, v_avatar_url)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.user_profiles enable row level security;

-- 表示名・アバターは画像カードや将来のプロフィールページで表示するため全員 SELECT 可
create policy "anyone can view user_profiles"
  on public.user_profiles
  for select
  using (true);

create policy "users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
