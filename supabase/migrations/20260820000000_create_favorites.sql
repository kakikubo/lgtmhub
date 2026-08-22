-- favorites: ユーザーごとのお気に入り LGTM 画像 (Issue #198 / PRD 機能4)
--
-- 非公開・個人リストとして扱う。お気に入り数の集計や人気順ランキングは提供しないため、
-- 本人以外が SELECT できる経路を一切作らない (RLS は auth.uid() = user_id のみ)。
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles (id) on delete cascade,
  lgtm_image_id uuid not null references public.lgtm_images (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 同一画像の二重お気に入りを防ぐ。アプリ側の重複判定 (409) もこの制約に依存する
  unique (user_id, lgtm_image_id)
);

-- 一覧取得 (自分の favorites を created_at desc でカーソルページネーション) の高速化
create index favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc);

-- 画像の物理削除・カスケード時に lgtm_image_id 側からも辿れるようにする
-- (unique (user_id, lgtm_image_id) の複合インデックスは先頭列が user_id のため効かない)
create index favorites_lgtm_image_id_idx
  on public.favorites (lgtm_image_id);

-- RLS
alter table public.favorites enable row level security;

-- 閲覧: 本人のみ
create policy "users can view own favorites"
  on public.favorites
  for select
  using (auth.uid() = user_id);

-- 登録: 本人としてのみ INSERT 可
create policy "users can insert own favorites"
  on public.favorites
  for insert
  with check (auth.uid() = user_id);

-- 解除: 本人のみ DELETE 可
create policy "users can delete own favorites"
  on public.favorites
  for delete
  using (auth.uid() = user_id);

-- UPDATE ポリシーは意図的に作らない。お気に入りは「作る / 消す」しかなく更新の余地がない。

-- Issue #274 と同方針で、RLS (行) に加えて GRANT (列) でも防御する。
--
-- 必要な権限を「デフォルト付与に頼らず明示的に付け直す」形にする。Supabase のプロジェクト
-- 作成時期によって public スキーマのデフォルト権限が異なり (新しい Supabase Local では
-- anon / authenticated に DML が既定で付かない)、暗黙の付与に依存すると環境差で壊れるため。
--
-- anon には一切付与しない。お気に入りは本人だけが読み書きする非公開データで、
-- 未ログインから触れる経路が存在しない。
revoke all on table public.favorites from anon, authenticated;

-- 一覧取得 (SELECT) と解除 (DELETE) は行全体で必要。行の絞り込みは RLS が担う。
grant select, delete on table public.favorites to authenticated;

-- 登録はアプリが実際に指定する 2 列だけに絞る。
-- id / created_at は default 生成であり、クライアントから指定させない。
-- UPDATE は付与しない (お気に入りは作る / 消すしかない)。
grant insert (user_id, lgtm_image_id) on table public.favorites to authenticated;
