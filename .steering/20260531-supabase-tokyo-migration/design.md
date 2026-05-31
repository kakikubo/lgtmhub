# design.md

## 全体方針

単一の Supabase プロジェクト(`szjjdsagnitpmzbbtfoy` / Singapore)を、新規作成済みの東京プロジェクト(`qbkoalhilwtjydpscrye` / ap-northeast-1)へ **1:1 置換**する。アプリは env 経由でのみ接続するため、コードの恒久的変更は不要(ドキュメントの ref 表記更新のみ)。

移設方式は Supabase 公式「Migrating within Supabase」の `supabase db dump` 3 分割(roles / schema / data)を採用。auth スキーマ(users / identities)を含めて移すことで GitHub ログインの同一性を維持する。

```
[Before]                                    [After]
Vercel preview ─┐                           Vercel preview ─┐
                ├→ szjjds...(Singapore)                     ├→ qbkoa...(Tokyo)
Vercel prod   ─┘                            Vercel prod   ─┘
画像: Vercel Blob(移設不要・URL 不変)        画像: Vercel Blob(変更なし)
```

## 移設方式の選択

| 案 | 内容 | 採否 |
|----|------|------|
| **公式 db dump 3 分割** | roles + schema + data を dump/restore。auth/roles をそのまま移送 | **採用**。公式手順で auth 同一性を確実に維持 |
| migrations push + data-only | 新プロジェクトに `db push` 後 data だけ流す | 却下。bootstrap migration と data restore の順序衝突リスク、schema_migrations 不整合 |
| Supabase 公式アップグレード機能 | 同一プロジェクト内のリージョン変更 | 不可。プロジェクト跨ぎの移設には非対応 |

## データ移設コマンド

`scripts/supabase-migrate-to-tokyo.sh` に集約(接続文字列は env 引数、シークレットはコミットしない):

```bash
supabase db dump --db-url "$OLD_URL" -f roles.sql  --role-only
supabase db dump --db-url "$OLD_URL" -f schema.sql
supabase db dump --db-url "$OLD_URL" -f data.sql   --data-only --use-copy

psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file roles.sql --file schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data.sql --dbname "$NEW_URL"
```

- `SET session_replication_role = replica`: data 投入中のトリガー/FK 無効化(auth FK・`set_updated_at` トリガー対策)。
- 投入後、`auth.users` / `public.user_profiles` / `lgtm_images` / `daily_upload_counts` の件数を新旧突合。

## 手動構成(Dashboard / Vercel / GitHub)

Claude からは実行不可。チェックリストとして tasklist.md に展開。

### 新プロジェクト Auth(Dashboard)

- Providers > GitHub: Client ID / Secret 登録。
- URL Configuration: **Site URL = 本番ドメイン**、**Additional Redirect URLs = preview ワイルドカード**(`docs/development-guidelines.md` L480-505 の `https://lgtmhub-git-*-kakikubos-projects.vercel.app/**` 等)。

### GitHub OAuth App callback

GitHub OAuth App の callback は 1 つのみ。**新規 OAuth App を作成**し callback を `https://qbkoalhilwtjydpscrye.supabase.co/auth/v1/callback` に(旧 App 温存でロールバック安全)。簡易策は既存 App の callback 差し替え(旧プロジェクト即無効化)。

### Vercel env(Preview / Production 両スコープ)

- `NEXT_PUBLIC_SUPABASE_URL` = `https://qbkoalhilwtjydpscrye.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` = 新プロジェクト値 → 再デプロイ。

### GitHub Secrets(`supabase-deploy.yml` 用)

- `SUPABASE_PROJECT_REF` = `qbkoalhilwtjydpscrye`
- `SUPABASE_DB_PASSWORD` = 新 DB パスワード

## migrations 整合

新プロジェクトに link 後 `supabase migration list --linked` を確認。`supabase_migrations.schema_migrations` が data dump に含まれず未適用表示の場合、各バージョンを `supabase migration repair --status applied <version>` で applied 化(スキーマは既存のため再 push しない)。最終的に `supabase db push --linked` が up-to-date になることを確認。

## ロールバック

Vercel env を旧値に戻す → OAuth callback を旧に戻す(簡易策の場合) → 旧プロジェクトは後始末フェーズまで温存しているため即復帰。

## リスクと対策

| リスク | 対策 |
|--------|------|
| 停止ウィンドウ中の書き込みロスト | 低トラフィック時に実施、数分で完了。必要なら直前に差分 data dump 再投入 |
| PG メジャーバージョン不一致 | 事前に新プロジェクトが 17(`config.toml` の `major_version`)であることを確認 |
| migrations 未適用表示で次回 push 失敗 | `migration repair --status applied` で同期 |
| OAuth callback 単一制約 | 新規 OAuth App 作成でロールバック余地確保 |
| preview ワイルドカード未登録でログインが本番に流れる | Additional Redirect URLs を確実に再登録 |
