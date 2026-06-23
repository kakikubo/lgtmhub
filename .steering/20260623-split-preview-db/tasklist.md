# tasklist.md

## Phase 1: Preview プロジェクト作成【手動・ダッシュボード】

- [x] Supabase Dashboard → New Project: `lgtmhub-preview` / Region Tokyo (ap-northeast-1)
- [x] DB パスワードを生成し保管
- [x] `project-ref` を控える(`mdnyanwprgtqscugnjif`)
- [x] `major_version 17` を確認(db push 成功で実証)

## Phase 2: Preview にスキーマ反映【手動・CLI 初回】

- [x] `supabase link --project-ref mdnyanwprgtqscugnjif`(preview の DB password を使用)
- [x] `supabase db push --linked`(5 マイグレーション適用、Local/Remote 一致)
- [ ] Dashboard で user_profiles / lgtm_images / daily_upload_counts と 3 関数・RLS を確認(任意)

## Phase 3: 本番 → Preview データコピー【手動・CLI】

- [x] 本番 / preview の Connection string (Session pooler URI) を取得
- [x] `supabase db dump --db-url "$PROD_DB_URL" --data-only -s auth -s public -f /tmp/data.sql`
- [x] `{ echo "set session_replication_role = replica;"; cat /tmp/data.sql; } | psql "$PREV_DB_URL"`
- [x] 行数突き合わせ一致(users=1 / profiles=1 / images=43 / counts=14)
- [ ] `/tmp/data.sql` を破棄(個人情報を含むためコミット・残置しない)

## Phase 4: config.toml に [remotes.preview] 追加【コード】

- [x] `supabase/config.toml` に `[remotes.preview]` ブロックを追加(prod と対称)
- [x] preview ref (`mdnyanwprgtqscugnjif`) / Vercel preview ドメイン / preview Supabase callback を設定

## Phase 5: CI 拡張【コード】

- [ ] `.github/workflows/supabase-deploy.yml` を prod/preview matrix 化
- [ ] GitHub Secrets を追加:
  - [ ] `SUPABASE_PREVIEW_PROJECT_REF`
  - [ ] `SUPABASE_PREVIEW_DB_PASSWORD`
  - [ ] `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_ID`
  - [ ] `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_SECRET`

## Phase 6: Vercel 環境変数スコープ分け【手動】

- [ ] Preview スコープに preview ref の URL / anon / service_role を登録
- [ ] Production スコープが本番値であることを再確認
- [ ] Build Cache 無効で Production / Preview を Redeploy

## Phase 7: Preview 用 GitHub OAuth + Auth URL【手動】

- [ ] Preview 専用 GitHub OAuth App 作成(callback = `https://<preview-ref>.supabase.co/auth/v1/callback`)
- [ ] Client ID/Secret を Phase 5 の Secrets に登録
- [ ] (config push 経由で)Preview の Auth Providers / URL Configuration が反映されることを確認

## Phase 8: ドキュメント更新【コード】

- [ ] `.env.example` / `docs/development-guidelines.md` に Preview 構成手順を追記

## Phase 9: 検証

- [ ] Preview URL で Supabase 初期化エラーが出ない
- [ ] Preview で GitHub ログイン成功
- [ ] **Preview で書き込んだデータが本番 DB に入っていない**(分離の実証)
- [ ] 本番 URL は従来どおり動作(リグレッションなし)
