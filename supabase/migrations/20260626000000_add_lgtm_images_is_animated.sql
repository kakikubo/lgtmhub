-- lgtm_images にアニメーション WebP かどうかを記録するフラグを追加する (Issue #201)
-- 既存行は静止 WebP のみ。DEFAULT false で自動付与され、追加マイグレーションは不要。
alter table public.lgtm_images
  add column is_animated boolean not null default false;
