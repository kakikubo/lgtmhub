# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

- 全てのタスクを `[x]` にすること
- 未完了タスク(`[ ]`)を残したまま作業を終了しない
- スキップ時は理由を明記: `- [x] ~~タスク名~~(理由)`

> 注: Dashboard / Vercel / GitHub Secrets の操作はユーザーの手動作業。Claude はチェックリストとスクリプトを提供する。

---

## Phase 0: 事前確認(ダウンタイムなし)

- [x] 新プロジェクト `qbkoalhilwtjydpscrye` のリージョン = `ap-northeast-1`(Tokyo)を確認
- [x] 新プロジェクトの Postgres major version = 17(実値 17.6.1.127 / LATEST、`config.toml` の `major_version` と一致)を確認
- [ ] 旧 `OLD_URL` / 新 `NEW_URL` の接続文字列を取得(Settings > Database、Session pooler)
- [ ] 旧プロジェクトの Auth 設定を控える(Site URL / Additional Redirect URLs / GitHub Client ID)

## Phase 1: スクリプト準備(Claude 作業)

- [x] `scripts/supabase-migrate-to-tokyo.sh` を作成(dump/restore、env 引数、シークレット非コミット)
- [x] スクリプトのヘルプ/前提チェック(`OLD_URL`/`NEW_URL` 未設定時はエラー終了)を実装

## Phase 2: データ移設(停止ウィンドウ開始 — 低トラフィック時)

- [x] `roles.sql` / `schema.sql` / `data.sql` を旧プロジェクトから dump(data は `auth,public` に限定)
- [x] 新プロジェクトへ `psql --single-transaction` で restore(`session_replication_role = replica`)
- [x] 件数突合: `auth.users` / `user_profiles` / `lgtm_images` / `daily_upload_counts` を新旧一致確認

## Phase 3: 新プロジェクト構成

- [ ] Auth > Providers > GitHub に Client ID / Secret を登録
- [ ] Auth > URL Configuration: Site URL(本番ドメイン) / Additional Redirect URLs(preview ワイルドカード)を登録
- [ ] GitHub OAuth App を新規作成し callback = `https://qbkoalhilwtjydpscrye.supabase.co/auth/v1/callback`(または既存 App 差し替え)
- [x] CLI を新プロジェクトに link し `supabase migration list --linked` を確認
- [x] 未適用表示を `supabase migration repair --status applied` で 5 本同期、`db push --linked` が up-to-date

## Phase 4: 切替(cutover)

- [x] Vercel env(Preview/Production 両スコープ)を新プロジェクト値へ差し替え
  - [x] `NEXT_PUBLIC_SUPABASE_URL`
  - [x] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [x] `SUPABASE_SERVICE_ROLE_KEY`
- [x] Vercel を再デプロイ
- [x] GitHub Secrets を更新: `SUPABASE_PROJECT_REF` / `SUPABASE_DB_PASSWORD`

## Phase 5: 検証(停止ウィンドウ終了)

- [ ] 本番/preview で GitHub ログイン(既存ユーザーが同一アカウントで入れる)
- [ ] 画像一覧 `/api/images` が表示される
- [ ] 画像アップロード(INSERT → Blob put → 一覧反映)が成功
- [ ] アップロード上限 RPC(`increment_daily_upload_count`)が機能
- [ ] `supabase db push --linked`(新)が「up to date」

## Phase 6: リポジトリ/メモリ更新(Claude 作業、切替成功後)

- [ ] `docs/development-guidelines.md` L892 等の旧 ref → `qbkoalhilwtjydpscrye`
- [ ] `.github/workflows/supabase-deploy.yml` のコメント(`lgtmdb`/Singapore)を更新
- [ ] `README.md` L75 周辺の記述を確認・更新
- [ ] メモリ `supabase-prod-region-singapore.md` を東京移設済みに更新
- [ ] Issue #152 をクローズ

## Phase 7: 後始末(猶予期間後)

- [ ] 数日〜1週間の安定確認後、旧プロジェクト `szjjdsagnitpmzbbtfoy` を pause → 削除
- [ ] (任意)`/api/images` TTFB を計測し ~70ms 削減を確認
