# 設計書

## アーキテクチャ概要

DB 層 (RLS) のみの変更で完結する。アプリ層 (Service / Repository / Route Handler / UI) は無変更。

```
Route Handler (DELETE /api/images/[id])
  → ImageService.deleteImage  ← ★無変更
  → ImageRepository.softDelete ← ★無変更
  → Supabase PostgREST (UPDATE ... WHERE ... RETURNING)
  → PostgreSQL RLS  ← ★ここを変更（SELECT ポリシー拡張）
```

## 変更方針: PERMISSIVE ポリシーの追加（差し替えない）

既存の `"anyone can view active images"` (USING `status = 'active'`) は **そのまま温存** し、所有者用と管理者用の SELECT ポリシーを **追加** する。PostgreSQL の PERMISSIVE ポリシーは OR で結合されるため、3 ポリシーの USING を OR 結合した SELECT 可視性が成立する:

```
visible_to_select =
     status = 'active'                                     -- 既存（公開）
  OR auth.uid() = uploader_id                               -- 追加（所有者）
  OR (admin EXISTS subquery)                                -- 追加（管理者）
```

### 一つの policy にまとめず分割する理由

1. **公開閲覧パスへの影響を最小化する**: 既存ポリシーを drop/create で差し替えると、本番一覧 API のホットパスに対する RLS 評価式が変わる。差分レビュー・回帰のリスクを削るため既存述語は据え置く
2. **ポリシー単位の可読性**: 「公開」「所有者」「管理者」の意図が policy 名と USING 式に 1:1 で表れる。後から削除・置き換える際の単位もこちらが自然
3. **PERMISSIVE OR 結合は PG の標準仕様**: 性能的にも公開パス (`status='active'`) が短絡評価されやすく、追加コストは管理者 EXISTS が高々 1 回（クエリ単位でキャッシュされる）

### post-update 可視性チェックが通る理由

PostgreSQL は UPDATE 後の新しい行が SELECT ポリシーの USING を満たすことを要求する。本人による論理削除では新しい行は `status='deleted', uploader_id = auth.uid()` となり、追加した「所有者」ポリシーの `auth.uid() = uploader_id` を満たすため可視性チェックが通る。

## コンポーネント設計

### 1. 新マイグレーション `20260506000000_extend_lgtm_images_select_policy.sql`

**責務**:
- `lgtm_images` の SELECT に対して 2 本の追加 PERMISSIVE ポリシーを作成する
- 既存ポリシー (`anyone can view active images` / `authenticated users can insert own images` / `owner or admin can update images`) には触れない

**SQL 概要**:

```sql
-- 所有者は自分の画像を status を問わず SELECT 可
-- 目的: post-update 可視性チェック (status='deleted' に書き換えた直後の新行) を通すため
-- 副作用: 一覧/詳細 API は WHERE 句で status='active' を強制しているため、
--         自分の deleted 行が一覧/詳細に混入することはない
create policy "owner can view own images"
  on public.lgtm_images
  for select
  using (auth.uid() = uploader_id);

-- 管理者は全ての画像を SELECT 可
-- 目的: 将来の管理者削除/モデレーション機能 (PRD 機能 6 / P1) の前提となる可視性
create policy "admin can view all images"
  on public.lgtm_images
  for select
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and is_admin = true
    )
  );
```

**実装の要点**:
- ファイル名は既存規則 `YYYYMMDDHHMMSS_<snake_case>.sql` に揃える (`20260506000000_...`)
- DDL は冪等にする必要はない（Supabase migrations は履歴管理されるため）
- 既存ポリシーを削除しないので、ロールバックは「追加した 2 ポリシーを drop」で済む

### 2. ローカル検証手順 (回帰防止)

**責務**: 修正の効果と既存仕様の維持を `docker exec ... psql` で検証する。

**シナリオ**:

| # | 操作 | 期待結果 |
|---|---|---|
| V1 | 認証済み所有者として自身の active 画像に softDelete 相当の UPDATE | 1 行更新成功（修正前は RLS エラー） |
| V2 | V1 直後、認証済み所有者として自分の `deleted` 行を SELECT | 取得できる（追加した所有者ポリシーが効く） |
| V3 | 別の認証済みユーザーとして他人の画像に softDelete 相当の UPDATE | 0 行更新・エラーなし（USING で弾かれる） |
| V4 | 匿名 (role=anon) で `lgtm_images` を SELECT | `status='active'` 行のみ取得できる、`deleted` 行は混入しない |
| V5 | 認証済み他人として `lgtm_images` を SELECT | `status='active'` 行のみ取得できる、自分以外の `deleted` 行は混入しない |
| V6 | V1 で deleted にした行を `findActiveById` 相当 (`select * where id=? and status='active'`) で取得 | `null` 相当（行なし） |

検証後、テスト用に書き換えた行 (`status='deleted'`) は元の `active` に戻して終わる。

### 3. ドキュメント更新

**docs/functional-design.md**:
- `### Supabase RLS ポリシー` (L675〜) のサンプル SQL を実装に揃える
  - 既存の SELECT policy はそのまま、所有者・管理者用の追加ポリシーを併記
  - `"owner or admin can delete"` という記述を実装に合わせて `"owner or admin can update"` に表記揃え（実態は INSERT/UPDATE/DELETE のうち UPDATE のみ）

## データフロー

### 本人による論理削除 (修正後)

```
1. UI: AlertDialog 確認 → DELETE /api/images/[id]
2. Route Handler: getUser() で user.id 確定
3. ImageService.deleteImage:
   - findActiveById で対象が active であることを確認 (NotFoundError 判定)
   - 所有者一致チェック (ForbiddenError 判定)
4. ImageRepository.softDelete:
   - UPDATE lgtm_images SET status='deleted', deleted_at=now()
     WHERE id=? AND uploader_id=? AND status='active'
     RETURNING id
5. RLS 評価:
   - UPDATE policy USING:  auth.uid() = uploader_id  → true
   - UPDATE policy WITH CHECK: 同上 → true
   - SELECT policy 集合の OR (post-update 可視性):
       status='active' (false) OR auth.uid()=uploader_id (true) OR admin(false) → true ✅
6. 1 行更新成功 → Service が正常終了 → Route Handler が 204
7. UI: router.refresh() → router.push('/')
```

## エラーハンドリング戦略

アプリ層は無変更。`AppError`/`DatabaseError` 等のマッピング (PR #32) はそのまま機能する。

## テスト戦略

### ユニットテスト

- 既存テスト (`tests/unit/repositories/image-repository.test.ts`、`image-service.test.ts`、`api/images/delete-route.test.ts`) は Supabase クライアントをモックしているため、本修正のスコープでは新規追加・変更不要。
- 全ケースが現状のまま PASS することを最終確認する。

### 統合 / 手動検証

- 上記「ローカル検証手順」V1〜V6 を psql で実行し、全期待結果と一致することを確認。
- Playwright `tests/e2e/image-deletion.test.ts` は未ログイン UI のみで認証経路はカバーしないため、Vercel Preview での手動確認 (PR #32 の Test plan に既出の項目) を改めて実施。

### 自動 RLS 統合テストについて

実 Supabase に対する RLS 統合テスト基盤は本リポジトリに未整備（既存テストは全てモック）。本修正のスコープでは導入しない。将来課題として `docs/development-guidelines.md` に追記するかは別途判断する（本 PR ではスコープ外）。

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
supabase/migrations/
  20260506000000_extend_lgtm_images_select_policy.sql  ← 新規

docs/functional-design.md                               ← 一部更新
.steering/20260506-fix-image-deletion-rls/              ← 本ステアリング
```

## 実装の順序

1. マイグレーション `20260506000000_extend_lgtm_images_select_policy.sql` を作成
2. ローカル DB に適用 (`supabase db reset` ではなく `supabase migration up` で差分適用、または `psql` で直接実行)
3. ローカル検証 V1〜V6 を実行
4. `docs/functional-design.md` の RLS ポリシー記述を更新
5. `npm test` / `npm run lint` / `npm run typecheck` / `npm run build` の通過確認
6. Playwright 通過確認
7. ステアリングの振り返り記録

## セキュリティ考慮事項

### 多層防御の維持

- アプリ層: Service の所有者チェック + Repository の `WHERE uploader_id=? AND status='active'` 強制
- DB 層: UPDATE policy の USING/WITH CHECK で本人 or 管理者を強制 (本修正で変更なし)
- 本修正で追加するのは SELECT 可視性のみ。書き込み権限は既存 UPDATE policy が引き続きガードする

### 「所有者は自分の deleted 行を SELECT できる」ことの安全性

- アプリ層 API はすべて WHERE 句で `status='active'` を強制しているため、deleted 行は API レスポンスに混入しない
- Supabase クライアントから直接 PostgREST に問い合わせれば自分の deleted 行は見える状態になるが、PRD 上「自分が登録した画像」は本人のデータであり、本人が見えること自体に問題はない
- 公開 SELECT (`status='active'`) は変わらないため、他人の deleted 行が公開されることはない

### 管理者ポリシーの妥当性

- PRD 機能 6 (管理者削除) では管理者は全画像を可視化する必要がある
- 本ポリシーは将来の管理者機能の前提条件としても自然
- 管理者になるには `user_profiles.is_admin=true` への手動更新が必要 (UPDATE policy `users can update own profile` に WITH CHECK `auth.uid() = id` があるが、`is_admin` カラムをユーザー自身が変更可能になる懸念あり)
  - これは PR #32 以前からの既存仕様であり、本 PR のスコープ外（必要なら別タスク化）

## パフォーマンス考慮事項

- 一覧 API (`status='active'` 50 件取得) は既存ポリシーで短絡評価され追加負荷ほぼゼロ
- 所有者ポリシーは `auth.uid() = uploader_id` の単純比較
- 管理者ポリシーの EXISTS は user_profiles の主キー検索 1 回。クエリ単位でキャッシュされる
- 想定 QPS でボトルネックになる構造ではない

## 将来の拡張性

- 「自分の削除済み画像を一覧する」画面の追加は、本ポリシーをそのまま流用できる
- 管理者用の「全画像モデレーション一覧」画面も同様に流用可能
- これらは別タスクで追加する
