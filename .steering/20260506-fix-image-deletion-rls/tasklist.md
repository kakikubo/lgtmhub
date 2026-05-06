# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: マイグレーション実装

- [x] `supabase/migrations/20260506000000_extend_lgtm_images_select_policy.sql` を新規作成
  - [x] ヘッダコメントで「PR #32 で発生した RLS post-update 可視性エラーの修正」「既存ポリシーは温存し追加 PERMISSIVE のみ」を明記
  - [x] `create policy "owner can view own images"` (FOR SELECT, USING `auth.uid() = uploader_id`) を作成
  - [x] `create policy "admin can view all images"` (FOR SELECT, USING `exists(...is_admin=true)`) を作成
  - [x] 既存ポリシーへの `drop` / `alter` が含まれていないことを確認

## フェーズ2: ローカル DB への適用と検証

- [x] ローカル Supabase にマイグレーションを適用
  - [x] 適用方法を確定（`supabase migration up` で差分適用、成功）
  - [x] `pg_policies` で `lgtm_images` の SELECT ポリシーが 3 本になっていることを確認
- [x] V1: 認証済み所有者として自身の active 画像を softDelete 相当 UPDATE → 1 行更新成功
- [x] V2: V1 直後、所有者として自分の `deleted` 行を SELECT → 取得できる
- [x] V3: 別の認証済みユーザーとして他人の active 画像を softDelete 相当 UPDATE → 0 行更新・エラーなし
- [x] V4: 匿名 (role=anon) で `lgtm_images` を SELECT → `deleted` 行が混入しない
- [x] V5: 認証済み他人として `lgtm_images` を SELECT → 自分以外の `deleted` 行が混入しない
- [x] V6: V1 で deleted にした行を `findActiveById` 相当 (`select * where id=? and status='active'`) → 0 行
- [x] 検証で書き換えた行を `status='active'` / `deleted_at=null` に戻す

## フェーズ3: ドキュメント更新

- [x] `docs/functional-design.md` の `### Supabase RLS ポリシー` ブロックを更新
  - [x] 既存 SELECT policy はそのまま残し、所有者・管理者用の追加ポリシーを併記
  - [x] `"owner or admin can delete"` → `"owner or admin can update"` の表記揃え

## フェーズ4: 品質チェック

- [x] `npm test`（150 ケース PASS。本ブランチに新規ユニットテスト追加なし、既存 PASS のみ）
- [x] `npm run check`（biome check . でエラー 0）
- [x] `npm run typecheck`（tsc --noEmit でエラー 0）
- [x] `npm run build`（Next.js ビルド成功）
- [x] Playwright `tests/e2e/image-deletion.test.ts` が PASS
- [x] 既存 Playwright 全件 PASS（13 件）

## フェーズ5: 振り返り

- [x] 実装後の振り返りを本ファイル下部に記録
  - [x] 実装完了日
  - [x] 計画と実績の差分
  - [x] 学んだこと
  - [x] 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
2026-05-06

### 計画と実績の差分

**計画と異なった点**:
- 計画通り。マイグレーション 1 本 + ドキュメント更新のみで完結
- アプリ層 (Service / Repository / Route Handler / UI) には一切手を入れず、PR #32 の多層防御の構造を維持できた

**新たに必要になったタスク**:
- なし

**技術的理由でスキップしたタスク**:
- なし

### 学んだこと

**技術的な学び**:
- **PostgreSQL RLS の post-update 可視性チェック**: UPDATE 後の新行は SELECT (ALL含む) ポリシーの USING 式も満たさなければならず、満たさないと `new row violates row-level security policy` が発生する。「ユーザーが自分から見えない場所に行を書き換えてしまう」ことを防ぐ仕様。今回の `status='active' → 'deleted'` のような状態遷移を伴う論理削除では、SELECT ポリシーが新状態をカバーする必要があった
- WITH CHECK 違反のエラーメッセージは UPDATE policy の WITH CHECK だけでなく SELECT policy の USING からも出る。UPDATE policy の USING / WITH CHECK が同一述語で通っているのにエラーが出る場合、SELECT policy 由来である可能性が高い
- PERMISSIVE ポリシーを複数本に分割すると、個別 USING 式の意図が policy 名と 1:1 に対応するため可読性が高い (公開閲覧 / 所有者 / 管理者) 。drop/create を避けることでロールバック手順も最小化できる
- ローカル Supabase に対して `set role authenticated; set request.jwt.claims '{...}'` で本番相当の RLS 評価を psql から再現可能。RLS の挙動は単体テストのモックでは検証できないため、この手法での疎通確認は実用的

**プロセス上の改善点**:
- バグの原因特定段階で「再現 → 仮説 → 切り分け (SELECT policy を `using (true)` に緩めると通る)」を踏んだことで、案 A の修正範囲を最小に絞れた
- ステアリングの design.md に検証シナリオ V1〜V6 を表形式で先に書き出したことで、実装後の検証が機械的に進められた

### 次回への改善提案
- **RLS 統合テストの基盤導入を検討する**: ユニットテストで Supabase クライアントをモックすると RLS の挙動は一切検証できない。今回のような「アプリ層は正しいが RLS で落ちる」バグはユニットテストでは絶対に捕まらない。実 Supabase ローカルに対して `@supabase/supabase-js` でアクセスする小規模な統合テスト (RLS 専用 smoke) を用意すれば、`add-feature` フローの中で RLS リグレッションを検出できる。本リポジトリには未整備のため、別タスクとして起票する候補
- **SELECT ポリシーが `using (status = ...)` のように状態カラムに依存する設計を行う際は、UPDATE で状態遷移する経路を必ず洗い出す**: 状態遷移先が SELECT 可視性を失う場合、所有者・管理者用の別 SELECT ポリシーを同時に追加するのが定石になる
- **PR #32 の Test plan の「(要手動) Vercel Preview で削除フローを実機確認」項目が未消化のままマージされたのが本不具合の漏れた直接原因**。「手動チェック未実施だがマージ可」のフローは見直し余地あり (e.g. Preview 検証チェックリストを Danger / lefthook / PR テンプレートで強制する)
