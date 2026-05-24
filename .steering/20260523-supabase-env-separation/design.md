# design.md

## 全体方針

Issue #4 は表面的には「`supabase/.env` のノイズを減らす」話だが、根本原因を辿ると **`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` が Next.js アプリコードでは一切参照されていない** ことに行き着く(`grep -rn "GITHUB_OAUTH_CLIENT" src app` で 0 件確認済み)。

したがって「2 ファイルの同期をどうするか」を頑張るのではなく、**OAuth キーを `supabase/.env` 専属にすることで同期問題そのものを設計で消す**。

```
[Before]                              [After]
.env.local ─┐                         .env.local       (Next.js 用、OAuth なし)
   (全部)   │ cp → supabase/.env      supabase/.env    (CLI 用、OAuth のみ)
            │       (全部)
            │                         各ファイルが単一責任。同期不要。
両方に OAuth がある = ドリフトリスク
```

## 変更対象ファイル

### 新規

| ファイル | 役割 |
|---|---|
| `supabase/.env.example` | Supabase CLI が読む env のテンプレート。現状は `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` のみ |

### 修正

| ファイル | 変更内容 |
|---|---|
| `.env.example` | `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` の 2 行および関連コメント(GitHub OAuth セクション全体)を削除 |
| `README.md` | L36 / L51-67 のセットアップ手順を `supabase/.env.example` 起点に書き換え |

### 削除

なし(`supabase/.env` 自体は `.gitignore` 対象でローカルのみ存在)。

## 詳細設計

### `supabase/.env.example` の内容

```bash
# =================================================================
# supabase/.env.example - Supabase CLI 用の環境変数テンプレート
#
# このファイルをコピーして supabase/.env を作成し、各値を埋めてください:
#   cp supabase/.env.example supabase/.env
#
# supabase/.env は .gitignore 済み(リポジトリにコミットしない)
#
# 注意: このファイルは Supabase CLI が config.toml の env(...) 参照を
# 解決するために読みます。Next.js アプリ (.env.local) とは別管理です。
# =================================================================

# GitHub OAuth (supabase/config.toml の [auth.external.github] が参照)
# https://github.com/settings/developers で OAuth App を作成し、
# Client ID / Client Secret をここに記入してください。
#
# 注意: Vercel Preview 環境でログイン後に本番ドメインへ流される場合、
# Supabase Dashboard > Auth > URL Configuration の Additional Redirect URLs に
# Preview ドメインのワイルドカードを登録すること。
#   例) https://lgtmhub-git-*-kakikubos-projects.vercel.app/**
# 詳細: docs/development-guidelines.md の「Vercel Preview 環境での認証設定」を参照。
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

設計上のポイント:
- 「Next.js アプリ (.env.local) とは別管理」と冒頭で明示し、混同を防ぐ
- root `.env.example` にあった Vercel Preview 関連コメントは、OAuth キーと一緒にこちら側へ移設
- `config.toml` の参照箇所(`[auth.external.github]`)を明記し、追加時の判断材料になるようにする

### `.env.example` の修正

下記ブロック全体(L18-28)を削除する:

```bash
# GitHub OAuth(Supabase Auth 経由で利用)
# https://github.com/settings/developers で OAuth App を作成し、
# Client ID / Client Secret を Supabase Dashboard の Auth > Providers に登録
#
# 注意: Vercel Preview 環境でログイン後に本番ドメインへ流される場合、
# Supabase Dashboard > Auth > URL Configuration の Additional Redirect URLs に
# Preview ドメインのワイルドカードを登録すること。
#   例) https://lgtmhub-git-*-kakikubos-projects.vercel.app/**
# 詳細: docs/development-guidelines.md の「Vercel Preview 環境での認証設定」を参照。
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

修正後の `.env.example` は「Supabase ローカル(URL/ANON/SERVICE_ROLE)」+ 「Vercel Blob (BLOB_READ_WRITE_TOKEN)」のみとなる。

### `README.md` の修正

#### L36 周辺(初回セットアップ Step 2)

```diff
 # 2. 環境変数の設定
 cp .env.example .env.local
-# .env.local を編集(Supabase / Vercel Blob / GitHub OAuth の値を記入)
+# .env.local を編集(Supabase / Vercel Blob の値を記入)
+# ※ GitHub OAuth の設定は次節「GitHub OAuth セットアップ」を参照
```

#### L51-71「GitHub OAuth セットアップ」セクション

書き換え方針:
- Step 3「Client ID / Client Secret を `.env.local` に貼り付け」→ 「`supabase/.env.example` をコピーして `supabase/.env` を作成し、そこに貼り付け」へ変更
- Step 4「Supabase CLI に env を渡してから再起動する」→ 内容を簡素化(2 択ではなく `supabase/.env` 一択)

修正後の構造(案):

```markdown
3. **`supabase/.env` を作成して** Client ID / Client Secret を記入:
   ```bash
   cp supabase/.env.example supabase/.env
   # supabase/.env を編集
   ```
   ```
   GITHUB_OAUTH_CLIENT_ID=<your_client_id>
   GITHUB_OAUTH_CLIENT_SECRET=<your_client_secret>
   ```
   ※ Supabase CLI は `.env.local` を読まないため、CLI 用に専用ファイルが必要です(`supabase/.env` は `.gitignore` 済み)。
4. `npm run db:stop && npm run db:start` で再起動。起動ログに `WARN: environment variable is unset: GITHUB_OAUTH_*` が出ないことを確認(`supabase/config.toml` の `[auth.external.github]` がこれらの env を参照する)。
5. `npm run dev` でトップページを開き、**GitHub でログイン** ボタンから動作確認。
```

`set -a && source .env.local && set +a` 代替案は削除する(B 改の単一責任分離と相容れないため)。

### ローカル移行手順(自分自身のための作業)

実装後に自分で実行する:

1. 既存の `supabase/.env` を削除
2. `cp supabase/.env.example supabase/.env` で再生成
3. 既存の `.env.local` を開き、OAuth 値を `supabase/.env` 側へ移し、`.env.local` からは削除
4. `npm run db:stop && npm run db:start` を実行し、`WARN: environment variable is unset: GITHUB_OAUTH_*` が出ないことを確認
5. `npm run dev` を起動し、GitHub ログイン目視

## 検証方針

| 検証項目 | 方法 |
|---|---|
| `supabase/.env.example` が正しい | `cat` で目視 |
| CLI に env が渡る | `npm run db:start` 起動ログに OAuth 関連の `WARN: environment variable is unset` が出ない |
| GitHub OAuth が動く | `npm run dev` → トップ「GitHub でログイン」→ 認証完了でリダイレクトが正常 |
| README 通りで新規開発者が立ち上がれる | 自分で `supabase/.env` を一度消して `cp supabase/.env.example supabase/.env` から手順を再実行 |

`npm test` / `npm run lint` / `npm run typecheck` は本変更がアプリコードに触らないため必須ではないが、念のため green を確認する。

## 採用しなかった案

### 案 A: 現状維持 (`cp .env.local supabase/.env`)

- メリット: シンプルで覚えやすい、ローテーション時にコピーし直せば良い
- デメリット: Issue #4 の指摘事項(ノイズ、将来の管理煩雑化)が残る。OAuth キーが 2 箇所に存在し続けるため同期忘れリスクが残る
- → Q1 で却下

### 案 B 原案: 両ファイルに OAuth を残し、`supabase/.env.example` は最小キーのみ

- メリット: root `.env.local` を見れば全 env が分かるという「一覧性」が残る
- デメリット: 同期問題は解消されない(OAuth ローテーション時に両方更新が必要)
- → Q4 で却下

### 案 C: シェル env 経由 (`set -a && source .env.local && set +a`)

- メリット: ファイルが 1 つで済む、env の唯一情報源が `.env.local` に統一
- デメリット: 毎セッション手動 source が必要、`npm run db:start` の前に毎回忘れずに実行する負担、エディタ起動のターミナルでも忘れがち
- → Q1 で却下

### 案 D: `OPENAI_API_KEY` も `supabase/.env.example` に含める

- メリット: Studio AI 機能を使う場合に警告ゼロにできる
- デメリット: Studio AI を実際に使わないなら不要なノイズ、OpenAI API キーは有料でローカル用に発行するコスト
- → Q3 で却下(必要になった時に追記する YAGNI)

### 案 E: `config.toml` の全 `env(...)` をコメントアウト含めて `supabase/.env.example` に列挙

- メリット: 将来必要になる env の発見可能性が高い
- デメリット: Issue #4 が指摘した「ノイズ」をテンプレート側で再現してしまう
- → Q2 で却下
