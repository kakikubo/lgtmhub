-- lgtm_images: 登録済み LGTM 画像のメタデータ
create table public.lgtm_images (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references public.user_profiles (id) on delete cascade,
  original_url text not null,
  image_url text not null,
  p_hash text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  mime_type text not null default 'image/webp',
  status text not null default 'active' check (status in ('processing', 'active', 'deleted')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- pHash 全件比較用 (現状は seq scan で十分だが、将来 pgvector 化する際の足掛かり)
create index lgtm_images_p_hash_idx on public.lgtm_images (p_hash);

-- 一覧取得 (status='active' を created_at desc で最大 50 件) の高速化
create index lgtm_images_status_created_at_idx
  on public.lgtm_images (status, created_at desc);

-- updated_at は user_profiles マイグレーションで作成済みの set_updated_at() を再利用
create trigger lgtm_images_set_updated_at
  before update on public.lgtm_images
  for each row execute function public.set_updated_at();

-- RLS
alter table public.lgtm_images enable row level security;

-- 閲覧: status='active' のみ全員 SELECT 可 (PRD 機能5)
create policy "anyone can view active images"
  on public.lgtm_images
  for select
  using (status = 'active');

-- 登録: 認証済みユーザーが自分を uploader として INSERT 可
create policy "authenticated users can insert own images"
  on public.lgtm_images
  for insert
  with check (auth.uid() = uploader_id);

-- 更新 (論理削除): 本人 or 管理者
create policy "owner or admin can update images"
  on public.lgtm_images
  for update
  using (
    auth.uid() = uploader_id
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  )
  with check (
    auth.uid() = uploader_id
    or exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
