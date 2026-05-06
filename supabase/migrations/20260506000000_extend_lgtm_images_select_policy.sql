-- lgtm_images の SELECT ポリシーを所有者・管理者にも開放する。
-- 目的: PR #32 で実装した論理削除 (status='active' → 'deleted') が、
--       PostgreSQL RLS の「UPDATE 後の新行も SELECT ポリシーの USING を満たす必要がある」
--       仕様に抵触し `new row violates row-level security policy` で失敗する問題を解消する。
--
-- 方針: 既存の `"anyone can view active images"` (USING status='active') は温存し、
--       所有者用と管理者用の SELECT ポリシーを追加する。PERMISSIVE ポリシーは OR で結合される。
--       UPDATE/INSERT 系の既存ポリシーには触れない。
--
-- 副作用: 所有者は自分の `deleted` 行を直接 PostgREST 経由で SELECT 可能になるが、
--         アプリ層の API はすべて WHERE 句で `status='active'` を強制しているため
--         一覧・詳細レスポンスに混入することはない。

-- 所有者は自分が uploader の画像を status を問わず SELECT 可
create policy "owner can view own images"
  on public.lgtm_images
  for select
  using (auth.uid() = uploader_id);

-- 管理者は全ての画像を SELECT 可 (将来の管理者削除/モデレーションの前提)
create policy "admin can view all images"
  on public.lgtm_images
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
