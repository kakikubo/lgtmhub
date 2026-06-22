# tasklist.md

## Phase 1: Preview プロジェクト作成【手動・ダッシュボード】

- [ ] Supabase Dashboard → New Project: `lgtmhub-preview` / Region Tokyo (ap-northeast-1)
- [ ] DB パスワードを生成し保管
- [ ] `project-ref` を控える
- [ ] `major_version 17` を確認(config.toml と一致)

## Phase 2: Preview にスキーマ反映【手動・CLI 初回】

- [ ] `supabase link --project-ref <preview-ref>`(preview の DB password を使用)
- [ ] `supabase db push --linked`
- [ ] Dashboard で user_profiles / lgtm_images / daily_upload_counts と 3 関数・RLS を確認

## Phase 3: 本番 → Preview データコピー【手動・CLI】

- [ ] 本番 / preview の Connection string (URI) を取得
- [ ] `supabase db dump --db-url "$PROD_DB_URL" --data-only -s auth -s public -f data.sql`
- [ ] `{ echo "set session_replication_role = replica;"; cat data.sql; } | psql "$PREV_DB_URL"`
- [ ] 行数突き合わせ(auth.users / user_profiles / lgtm_images）で一致を確認
- [ ] `data.sql` を破棄(個人情報を含むためコミット・残置しない)

## Phase 4: config.toml に [remotes.preview] 追加【コード】

- [ ] `supabase/config.toml` に `[remotes.preview]` ブロックを追加(prod と対称)
- [ ] preview ref / Vercel preview ドメイン / preview Supabase callback を設定

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
