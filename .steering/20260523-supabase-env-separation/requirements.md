# requirements.md

## 関連 Issue

- 本タスク: [#4](https://github.com/kakikubo/lgtmhub/issues/4) supabase/.env の運用方針を整理する
- 関連: PR #2 (該当の暫定対応 commit 68febc0「README に Supabase CLI への env 渡し手順を追記」)

## 背景

PR #2 で「Supabase CLI が `.env.local` を読まない」問題への暫定対応として、README に `cp .env.local supabase/.env` 手順を追加した。
現状 `supabase/.env` には `.env.local` の中身が**全部**コピーされる運用になっているが、CLI が実際に必要とするのは `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` の 2 つのみ。
それ以外の値(`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` / `BLOB_READ_WRITE_TOKEN`)は CLI 側で参照されず、新しい開発者の混乱や将来の管理煩雑化のリスクがある。

加えて調査の結果、`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` は Next.js アプリコードでは**一切参照されていない**ことが判明した(`supabase/config.toml` の `[auth.external.github]` セクション経由でのみ利用される)。したがって、これらを `.env.local` に置く必要は本来ない。

## やりたいこと

### 設計方針

**「root `.env.local` = Next.js 用」「`supabase/.env` = Supabase CLI 用」と単一責任に分離する。**

両ファイルで同じキーを持たないため、シークレットローテーション時の同期問題が**設計レベルで消える**。

### 具体的な変更

#### 1. `supabase/.env.example` を新規作成

CLI が実際に参照するキー(unset 警告が出るキー)のみを記載:

- `GITHUB_OAUTH_CLIENT_ID`
- `GITHUB_OAUTH_CLIENT_SECRET`

将来 `config.toml` で参照する env が増えたら、その時点で追記する(YAGNI)。

#### 2. root `.env.example` から OAuth キーを削除

- `GITHUB_OAUTH_CLIENT_ID=`
- `GITHUB_OAUTH_CLIENT_SECRET=`
- および関連するコメント行 (Vercel Preview Redirect URLs の注意書きなど) を `supabase/.env.example` 側へ移設

#### 3. README 最小差分修正

- L36 のコメント「Supabase / Vercel Blob / GitHub OAuth の値を記入」から「GitHub OAuth」を削除
- L65-67 の手順を `cp supabase/.env.example supabase/.env` 起点に書き換え:
  - 旧: 「`cp .env.local supabase/.env` (CLI が自動で読む。`supabase/.env` は `.gitignore` 済み)」
  - 新: 「`cp supabase/.env.example supabase/.env` してから OAuth Client ID / Secret を `supabase/.env` に記入」
- L60-64 の「`.env.local` に貼り付け」も対象が `supabase/.env` に変わるため修正

その他のセクション(L51-64「OAuth App 作成」、L73「Vercel 本番」など)は B 改と矛盾しない範囲で部分修正のみ。

## スコープ

- **対象**:
  - `supabase/.env.example` の新規作成
  - root `.env.example` から OAuth 2 キーと関連コメントを削除
  - README の最小差分修正
- **対象外**:
  - シェル env 経由(`set -a && source .env.local && set +a`)方式の採用
  - npm script で env 読み込みを自動化するラッパー
  - dotenvx 等の外部ツール導入
  - 他の `config.toml` env 参照(`OPENAI_API_KEY` 等、現在 unset 警告が出るとしてもこの PR では追加しない)

## 完了条件

- [ ] `supabase/.env.example` が新規作成され、`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` の 2 キーのみを含む
- [ ] root `.env.example` から OAuth 2 キーおよび関連コメントが削除されている
- [ ] README L36 のコメントから「GitHub OAuth」が削除されている
- [ ] README L60-67 が `supabase/.env.example` → `supabase/.env` 起点の手順に書き換えられている
- [ ] 自分の `supabase/.env` を再生成し、`npm run db:stop && npm run db:start` で `WARN: environment variable is unset: GITHUB_OAUTH_*` が出ないことを確認
- [ ] `npm run dev` でトップから GitHub ログインが通ることを目視確認
- [ ] 1 PR にまとめてマージする(関心事:「OAuth env の管轄を Supabase CLI 側に分離する」)

## 留意点

- **gitignore**: ルート `.gitignore:66` に `.env` 行があり、`supabase/.env` も既に ignore されている(`git check-ignore` で確認済み)。追加対応不要。
- **`supabase/.env.example` の git 管理**: `supabase/.gitignore` は `.env.example` を ignore していないため、コミット可能。
- **Vercel 本番との整合**: 本番では Supabase Dashboard > Auth > Providers に直接 OAuth 値を登録するため、root `.env.local` から OAuth を削除しても本番デプロイには影響しない (README L73 で既に言及済み)。
- **既存ローカル状態の移行**: 自分の `supabase/.env` を一度削除し、`cp supabase/.env.example supabase/.env` で再生成。`.env.local` の OAuth 行も削除して整合させる(他の開発者と同じ手順を自分も踏むことで README の正しさを検証できる)。
- **検証方法の二重性**: 警告ログの消失と OAuth ログインの目視確認を両方行う(行動原則「動作を証明できるまで完了としない」に従う)。
