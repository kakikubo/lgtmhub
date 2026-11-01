-- lgtm_images への書き込みをサーバー専用 RPC に集約する。
--
-- 既存の INSERT / UPDATE ポリシーは「どの行に触れるか」(本人 or 管理者) だけを制限し、
-- 「どのカラムに・どんな値で触れるか」は制限しない。Supabase はデフォルトで anon /
-- authenticated にテーブル全体の INSERT / UPDATE 権限を付与するため、アプリの登録フロー
-- (日次上限・取得・検証・重複判定・合成) を通らない書き込みを DB 側で拒否できない。
--
-- 対策として anon / authenticated の書き込み権限を剥奪し、書き込みは SECURITY DEFINER の
-- RPC だけにする。RPC の実行権限は service_role にのみ付与する (consume_rate_limit と同じ型)。
-- SECURITY DEFINER は関数オーナー権限で動くため、service_role 自体のテーブル権限には依存しない。

revoke insert, update, delete on table public.lgtm_images from anon, authenticated;

-- 書き込み権限が無いロールにしか効かない死にポリシーになるため削除する。SELECT ポリシーは維持。
drop policy if exists "authenticated users can insert own images" on public.lgtm_images;
drop policy if exists "owner or admin can update images" on public.lgtm_images;

-- 画像登録。status は 'active' 固定、created_at / updated_at は default に任せる。
create or replace function public.create_lgtm_image(
  p_uploader_id uuid,
  p_original_url text,
  p_image_url text,
  p_p_hash text,
  p_width integer,
  p_height integer,
  p_file_size_bytes integer,
  p_mime_type text,
  p_is_animated boolean
)
returns setof public.lgtm_images
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_uploader_id is null then
    raise exception 'uploader is required' using errcode = '22023';
  end if;

  return query
  insert into public.lgtm_images (
    uploader_id, original_url, image_url, p_hash, width, height,
    file_size_bytes, mime_type, is_animated, status
  )
  values (
    p_uploader_id, p_original_url, p_image_url, p_p_hash, p_width, p_height,
    p_file_size_bytes, p_mime_type, p_is_animated, 'active'
  )
  returning *;
end;
$$;

-- 論理削除。本人の active な行だけを対象にし、更新行数を返す (0 = 該当なし)。
create or replace function public.soft_delete_lgtm_image(
  p_id uuid,
  p_uploader_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.lgtm_images
  set status = 'deleted', deleted_at = now()
  where id = p_id
    and uploader_id = p_uploader_id
    and status = 'active';

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- 管理者による再生成後の更新。管理者判定を DB 側でも行う (Route の requireAdmin との多層防御)。
-- 対象が無い / active でない場合は 0 行を返す。p_original_url が null なら据え置き。
create or replace function public.update_lgtm_image_after_regenerate(
  p_id uuid,
  p_requester_id uuid,
  p_image_url text,
  p_p_hash text,
  p_width integer,
  p_height integer,
  p_file_size_bytes integer,
  p_is_animated boolean,
  p_original_url text default null
)
returns setof public.lgtm_images
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.user_profiles
    where id = p_requester_id and is_admin = true
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  update public.lgtm_images
  set
    image_url = p_image_url,
    p_hash = p_p_hash,
    width = p_width,
    height = p_height,
    file_size_bytes = p_file_size_bytes,
    is_animated = p_is_animated,
    original_url = coalesce(p_original_url, original_url)
  where id = p_id
    and status = 'active'
  returning *;
end;
$$;

revoke all on function public.create_lgtm_image(uuid, text, text, text, integer, integer, integer, text, boolean)
  from public, anon, authenticated;
grant execute on function public.create_lgtm_image(uuid, text, text, text, integer, integer, integer, text, boolean)
  to service_role;

revoke all on function public.soft_delete_lgtm_image(uuid, uuid) from public, anon, authenticated;
grant execute on function public.soft_delete_lgtm_image(uuid, uuid) to service_role;

revoke all on function public.update_lgtm_image_after_regenerate(uuid, uuid, text, text, integer, integer, integer, boolean, text)
  from public, anon, authenticated;
grant execute on function public.update_lgtm_image_after_regenerate(uuid, uuid, text, text, integer, integer, integer, boolean, text)
  to service_role;
