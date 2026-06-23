# tasklist.md

## Phase 1: Preview プロジェクト作成【手動・ダッシュボード】

- [x] Supabase Dashboard → New Project: `lgtmhub-preview` / Region Tokyo (ap-northeast-1)
- [x] DB パスワードを生成し保管
- [x] `project-ref` を控える(`mdnyanwprgtqscugnjif`)
- [x] `major_version 17` を確認(db push 成功で実証)

## Phase 2: Preview にスキーマ反映【手動・CLI 初回】

- [x] `supabase link --project-ref mdnyanwprgtqscugnjif`(preview の DB password を使用)
- [x] `supabase db push --linked`(5 マイグレーション適用、Local/Remote 一致)
- [x] `Loading config override: [remotes.preview]` で remote 上書きが効くことを確認

## Phase 3: 本番 → Preview データコピー【手動・CLI】

- [x] 本番 / preview の Connection string (Session pooler URI) を取得
- [x] `supabase db dump --db-url "$PROD_DB_URL" --data-only -s auth -s public -f /tmp/data.sql`
- [x] `{ echo "set session_replication_role = replica;"; cat /tmp/data.sql; } | psql "$PREV_DB_URL"`
- [x] 行数突き合わせ一致(users=1 / profiles=1 / images=43 / counts=14)
- [x] `/tmp/data.sql` を破棄(個人情報を含むためコミット・残置しない)

## Phase 4: config.toml に [remotes.preview] 追加【コード】

- [x] `supabase/config.toml` に `[remotes.preview]` ブロックを追加(prod と対称)
- [x] preview ref (`mdnyanwprgtqscugnjif`) / Vercel preview ドメイン / preview Supabase callback を設定

## Phase 5: CI 拡張【コード】

- [x] `.github/workflows/supabase-deploy.yml` を prod/preview matrix 化(再利用 WF `_supabase-push.yml` + preview は `vars.PREVIEW_DB_ENABLED` ゲート)
- [x] GitHub Secrets を追加:
  - [x] `SUPABASE_PREVIEW_PROJECT_REF`
  - [x] `SUPABASE_PREVIEW_DB_PASSWORD`
  - [x] `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_ID`
  - [x] `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_SECRET`
  - [x] Variable `PREVIEW_DB_ENABLED=true`

## Phase 6: Vercel 環境変数スコープ分け【手動】

- [x] Preview スコープに preview ref の URL / anon / service_role を登録
- [x] Production スコープが本番値であることを再確認(誤削除→再投入で復旧。`vercel env ls` で prod/preview 各3変数を確認)
- [x] Build Cache 無効で Preview を Redeploy(production Redeploy は #202 マージ時に自動実行)

## Phase 7: Preview 用 GitHub OAuth + Auth URL【手動】

- [x] Preview 専用 GitHub OAuth App 作成(callback = `https://mdnyanwprgtqscugnjif.supabase.co/auth/v1/callback`)
- [x] Client ID/Secret を Phase 5 の Secrets に登録
- [x] (config push 経由で)Preview の Auth Providers / URL Configuration が反映(#202 マージの preview ジョブ success で確定)

## Phase 8: ドキュメント更新【コード】

- [x] `.env.example` / `docs/development-guidelines.md` に Preview 構成手順を追記

## Phase 9: 検証

- [x] Preview URL で Supabase 初期化エラーが出ない(検証用 Preview デプロイで確認)
- [x] Preview で GitHub ログイン成功(`kakikubo` でログイン状態を確認)
- [x] **Preview で書き込んだデータが本番 DB に入っていない**(`lgtm_images`: prod=43 / preview=44。Preview のみの画像が Preview デプロイに表示)
- [x] 本番 URL は従来どおり動作(#202 マージ後の本番 Redeploy 後、`https://lgtmhub.vercel.app` が title=LGTMHub / 初期化エラーなしで応答)
