-- Issue #327: 一覧のカーソルページネーションを (created_at, id) 複合 keyset に揃える。
-- 既存の created_at 単独インデックスを、tie-break 用の id desc を末尾に持つ複合へ置き換える。

drop index if exists public.lgtm_images_status_created_at_idx;
create index lgtm_images_status_created_at_idx
  on public.lgtm_images (status, created_at desc, id desc);

drop index if exists public.favorites_user_id_created_at_idx;
create index favorites_user_id_created_at_idx
  on public.favorites (user_id, created_at desc, id desc);
