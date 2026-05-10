# 要求: middleware の matcher を保護ルートのみに絞る

## 背景

Issue [#46](https://github.com/kakikubo/lgtmhub/issues/46) の改善案 #2 を実装する。

`middleware.ts:31` の matcher は `_next/static`, `_next/image`, `favicon.ico`, 画像拡張子のみを除外している。結果として、ログイン不要で見れるトップページ (`/`) や画像詳細ページ (`/images/[id]`) でも `supabase.auth.getUser()` が走り、Supabase へ 1 RTT 余計に発生している。

改善案 #1 (unstable_cache 化) と #3 (`Cache-Control` 付与) は別 PR で扱う。本 PR は **#2 のみ** にスコープを絞る。

## 現状

- `middleware.ts:25` で全 HTML リクエストに対し `supabase.auth.getUser()` を実行
- `app/(site)/page.tsx` (HomeContent) でも `supabase.auth.getUser()` を実行 → トップ閲覧で 2 重の Supabase 往復
- middleware の本来の役割は「session refresh の副作用として cookie を更新する」こと (中の TODO コメント参照)
- 認証が必須な経路:
  - `app/(site)/images/new/page.tsx`: 未ログイン時 `redirect('/?auth_error=login_required')`
  - `app/api/images/route.ts` `POST`: 401 を返す
  - `app/api/images/[id]/route.ts` `DELETE`: 401 を返す
- 認証 Cookie を **自前で書き換える** Route (middleware 不要):
  - `app/api/auth/callback/route.ts`: `exchangeCodeForSession` で `response.cookies.set` を直接実行
  - `app/api/auth/test-signin/route.ts`: `signInWithPassword` で `response.cookies.set` を直接実行

## 要求

### 機能要求

1. `middleware.ts` の `config.matcher` を、認証必須ルートのみに絞る
2. トップページ (`/`)、画像詳細ページ (`/images/[id]`)、`/api/images` GET など read-only ルートでは middleware を実行しない
3. 認証必須ルート (`/images/new`, `/api/images` POST, `/api/images/[id]` DELETE) では引き続き session refresh が走る

### 非機能要求

- 既存の認証フロー (GitHub OAuth ログイン → コールバック → セッション維持) を壊さない
- 既存の E2E テストがパスする
- 1 PR = 1 関心事原則を遵守する (キャッシュ周りや region 設定は別 PR)

### スコープ外

- 改善案 #1 (`unstable_cache` 化) — **既に実装済**
- 改善案 #3 (`/api/images` への `Cache-Control` 付与) — 別 PR
- 改善案 #4 (Vercel/Supabase region 揃え) — 環境設定のみ、コード変更なし

## 完了条件

1. `middleware.ts` の matcher が保護ルートのみを列挙する形に変わっている
2. `npm test` / `npm run lint` / `npm run typecheck` が全てパス
3. dev サーバーで以下を目視確認できる:
   - `/` 表示時に middleware が実行されない (Network/Server log で確認)
   - `/images/new` にアクセスすると middleware 経由で `auth.getUser()` が呼ばれる
   - 認証済ユーザーで `/api/images` POST が成功する
4. 既存 E2E (`tests/e2e/`) がパス
