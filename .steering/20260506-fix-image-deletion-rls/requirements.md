# 要求内容

## 概要

PR #32 で実装した画像論理削除 (`DELETE /api/images/[id]` → `ImageRepository.softDelete`) が、本人による削除でも RLS エラーで失敗する不具合を修正する。SELECT ポリシーを所有者・管理者にも開放する案 A で解決する。

## 背景

PR #32 マージ後、本人が自分の画像詳細から「削除」を実行すると以下のエラーで 500 が返り、削除が成立しない:

```
Error [DatabaseError]: new row violates row-level security policy for table "lgtm_images"
```

### 原因

`supabase/migrations/20260504000000_create_lgtm_images.sql` の RLS は以下の組み合わせ:

- SELECT: `using (status = 'active')`
- UPDATE: `using/with check (auth.uid() = uploader_id OR <admin>)`

PostgreSQL の RLS には「UPDATE 後の新しい行も、適用される SELECT (または ALL) ポリシーの USING 式を満たさなければならない」という仕様があり、ユーザーが自分から見えない状態に行を書き換えることを防いでいる。本機能は `status` を `active` → `deleted` に書き換えるため、UPDATE policy 自体は通過しても、新しい行が SELECT policy `status='active'` を満たさず `new row violates row-level security policy` が発生する。

ローカル DB で再現確認済み:
- 該当ユーザーの JWT クレームで `UPDATE ... SET status='deleted'` を発行 → 同じエラー
- SELECT ポリシーを `using (true)` に一時的に緩めると成功

### PR #32 のテストで漏れた理由

- ユニットテスト (`tests/unit/repositories/image-repository.test.ts`) は Supabase クライアントをモックしており実 RLS を経由しない
- E2E (`tests/e2e/image-deletion.test.ts`) は未ログイン UI のみカバーし、認証済みでの DELETE 経路は未検証

## 実装対象の機能

### 1. SELECT ポリシーの拡張（案 A）

- `lgtm_images` の SELECT ポリシーを「`status='active'` または 自分が uploader または 管理者」に拡張する
- 所有者・管理者は status を問わず自分の (または全員の) 画像行を SELECT 可能になり、UPDATE 後の post-update 可視性チェックが通る
- 一覧 API (`ImageRepository.list`) / 詳細 API (`findActiveById`) は WHERE 句で `status='active'` を強制しているため、所有者の deleted 行が一覧や詳細に漏れることはない

### 2. ローカル DB での回帰防止テスト

- 実 RLS を経由する形で「本人の active 画像を softDelete できる」「他人の画像は softDelete できない (0 行)」を確認
- 既存ユニットテストはモックなのでカバー外。新規 SQL レベル or Repository レベルのテストでカバーする (詳細は design.md)

## 受け入れ条件

### SELECT ポリシー拡張

- [ ] 新マイグレーション 1 本で SELECT ポリシーを差し替え (drop + create)
- [ ] 認証済みユーザーが自分の `active` 画像に対して `softDelete` を実行 → 1 行更新成功
- [ ] 認証済みユーザーが他人の画像に対して `softDelete` を実行 → 0 行更新（既存仕様維持）
- [ ] 未認証ユーザーが `softDelete` を実行 → 0 行更新（既存仕様維持）
- [ ] 一覧 API レスポンスに自分の `deleted` 画像が混入しない
- [ ] 詳細 API (`findActiveById`) で自分の `deleted` 画像にアクセス → `null`

### 回帰防止テスト

- [ ] ローカル Supabase に対してマイグレーション適用済みで `npm test` (vitest) が通る
- [ ] Playwright (`tests/e2e/image-deletion.test.ts`) が通る (既存の未ログイン UI ケース)

### ドキュメント整合

- [ ] `docs/functional-design.md` の RLS ポリシー記述を新ポリシーに合わせて更新
- [ ] PR #32 のステアリング (`.steering/20260505-image-deletion/verification.md` など) には触れない (履歴として保存)

## 成功指標

- Vercel Preview / 本番デプロイ後、自分の画像を画像詳細ページから削除 → トップに戻り該当画像が一覧から消える、というフローが通る
- RLS による多層防御の方針 (PR #32) を維持したまま修正できる

## スコープ外

- SECURITY DEFINER 関数化（案 B）、service-role クライアント経由（案 C）はユーザー判断で却下済み
- 管理者削除 (PRD 機能 6 / P1) 本実装。ただし RLS の「管理者は status を問わず SELECT できる」分は副次的に成立する
- 自分の deleted 画像を一覧する画面・履歴機能（将来の Undo / 履歴に流用は可だが、本 PR では追加しない）
- Vercel Blob からの物理削除（PRD 機能 8 / P1）

## 参照ドキュメント

- `docs/product-requirements.md` - PRD P0 #2「画像削除機能」
- `docs/functional-design.md` - 画像削除フロー / RLS / セキュリティ
- `docs/architecture.md` - Route Handler → Service → Repository
- `.steering/20260505-image-deletion/` - PR #32 のステアリング（履歴）
