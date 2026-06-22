# design.md

## アーキテクチャ

```
                ┌─ Production Supabase (qbkoalhilwtjydpscrye / lgtm2, Tokyo) ─ 本番DB(現状維持)
Vercel ─────────┤
   ├ Production スコープ env → 本番 ref
   └ Preview スコープ env  → └─ Preview Supabase (新規 lgtmhub-preview, Tokyo) ── Preview DB(新規)
```

- 独立した 2 つ目の Supabase プロジェクトを Preview 専用 DB とする
- アプリは env 参照のみ。Vercel の env スコープ(Production / Preview)で参照先が決まる
- migrations / config は CI が main マージ時に prod・preview 両方へ push

## データコピー設計(本番 → Preview / フルコピー)

### FK 依存と落とし穴

```
auth.users ──< public.user_profiles ──< public.lgtm_images
                                    └──< public.daily_upload_counts
```

- `user_profiles.id` は `auth.users(id)` を参照 → auth を含めないと FK 不整合
- `auth.users` への insert で `handle_new_user` トリガ(after insert)が発火し
  `user_profiles` を自動 insert する → データダンプの user_profiles 行と **PK 衝突**
- 対策: リストアを `session_replication_role = replica` で実行しトリガを無効化

### 手順(CLI)

```bash
PROD_DB_URL="<本番 Connection string (URI)>"   # Dashboard > Settings > Database
PREV_DB_URL="<preview Connection string (URI)>"

# data-only ダンプ(auth + public)
supabase db dump --db-url "$PROD_DB_URL" --data-only -s auth -s public -f data.sql

# トリガ無効化リストア
{ echo "set session_replication_role = replica;"; cat data.sql; } | psql "$PREV_DB_URL"

# 検証: 行数突き合わせ
psql "$PROD_DB_URL" -c "select 'users',count(*) from auth.users union all select 'profiles',count(*) from public.user_profiles union all select 'images',count(*) from public.lgtm_images;"
psql "$PREV_DB_URL" -c "select 'users',count(*) from auth.users union all select 'profiles',count(*) from public.user_profiles union all select 'images',count(*) from public.lgtm_images;"
```

- `auth.identities` も同梱され GitHub の数値 user id が同一のため、Preview 用に別 OAuth App を
  作っても既存ユーザーのログイン継続が効く
- 画像実体は Vercel Blob にあり、lgtm_images 行は同じ Blob URL を指す(コピー対象外)

## config.toml: `[remotes.preview]`

`[remotes.prod]` と対称に、preview の `project_id` で applies。base(localhost)を
preview の Vercel ドメインで上書きする。

```toml
[remotes.preview]
project_id = "<preview-ref>"

[remotes.preview.auth]
site_url = "https://lgtmhub-git-<branch>-<team>.vercel.app"   # Preview の代表ドメイン
additional_redirect_urls = ["https://lgtmhub-*-<team>.vercel.app/**"]

[remotes.preview.auth.external.github]
redirect_uri = "https://<preview-ref>.supabase.co/auth/v1/callback"

[remotes.preview.auth.mfa.totp]
enroll_enabled = true
verify_enabled = true

[remotes.preview.auth.email]
enable_confirmations = true
max_frequency = "1m0s"
otp_length = 8
```

## CI: `supabase-deploy.yml` の matrix 化

prod / preview を matrix で直列(or 並列)実行。target ごとに ref / db password /
OAuth secrets を切り替える。

| Secret | prod | preview |
|--------|------|---------|
| project ref | `SUPABASE_PROJECT_REF` | `SUPABASE_PREVIEW_PROJECT_REF` |
| db password | `SUPABASE_DB_PASSWORD` | `SUPABASE_PREVIEW_DB_PASSWORD` |
| GitHub OAuth ID | `SUPABASE_GITHUB_OAUTH_CLIENT_ID` | `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_ID` |
| GitHub OAuth Secret | `SUPABASE_GITHUB_OAUTH_CLIENT_SECRET` | `SUPABASE_PREVIEW_GITHUB_OAUTH_CLIENT_SECRET` |

- `SUPABASE_ACCESS_TOKEN` は共通
- concurrency group は維持(部分適用回避)。matrix は `max-parallel: 1` で直列化し
  片方失敗時にもう片方を巻き込まないよう `fail-fast: false`

## Vercel 環境変数(スコープ分け)

| 変数 | Production | Preview |
|------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | 本番 ref | preview ref |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本番 `sb_publishable_*` | preview `sb_publishable_*` |
| `SUPABASE_SERVICE_ROLE_KEY` | 本番 `sb_secret_*` | preview `sb_secret_*` |
| `BLOB_READ_WRITE_TOKEN` | 共通可 | 共通可 |

→ 設定後、Build Cache 無効で Production / Preview ともに Redeploy(NEXT_PUBLIC_* はビルド時埋め込み)

## ロールバック

- Preview プロジェクトは独立しているため、問題時は Vercel Preview env を本番値に戻すだけで
  従来の共有構成に戻せる(本番には影響しない)
- config.toml の `[remotes.preview]` は preview ref にしか適用されず本番に影響しない
