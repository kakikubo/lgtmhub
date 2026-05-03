# 要求内容: GitHub OAuth 認証

## 目的

`docs/product-requirements.md` の P0 機能 #3「GitHub OAuth 認証」を実装し、後続の P0 機能（画像登録 / お気に入り / 削除）が認証ユーザーを前提にできる土台を提供する。

scaffolding（`20260502-project-scaffolding`）の申し送り事項として明示された次の項目もこの作業に含める:

- `middleware.ts` の追加（Supabase セッションのリフレッシュ）
- `src/lib/errors.ts` への `UnauthorizedError` / `ForbiddenError` 追加
- `supabase/migrations/` への `user_profiles` テーブル定義の追加
- `glossary.md` への 上記新規エラー追記

## 背景

- scaffolding 完了時点では `app/` `src/lib/supabase/` 等の空きディレクトリ・基盤コードしかなく、認証フロー・セッション管理・ユーザープロフィールの永続化が未実装
- すべての書き込み API（画像登録・お気に入り・削除）は「ログイン必須」であり、本機能なしでは MVP の他の機能着手ができない
- Supabase Auth は GitHub OAuth を標準サポートしており、SDK 側もすでに依存に含まれている (`@supabase/supabase-js` / `@supabase/ssr`)

## 範囲

### 含むもの

1. **DB スキーマ追加**
   - `supabase/migrations/20260503000000_create_user_profiles.sql`:
     - `user_profiles` テーブル（PRD / functional-design.md / repository-structure.md の定義に従う）
     - RLS ポリシー: 全員 SELECT 可、本人のみ INSERT / UPDATE
     - `updated_at` 自動更新トリガ
     - `auth.users` への INSERT トリガで `user_profiles` を初回作成（GitHub OAuth metadata から `github_login` / `display_name` / `avatar_url` を抽出）
   - `src/types/database.types.ts` の生成（`npm run db:types`）またはマイグレーションに合わせた最小手書き

2. **共通基盤コード追加**
   - `src/lib/errors.ts` に `UnauthorizedError` (401) / `ForbiddenError` (403) を追加
   - `middleware.ts`（ルート直下）で Supabase セッションのリフレッシュとクッキー伝播

3. **認証フローの実装**
   - サインイン Server Action: `src/lib/auth/actions.ts` に `signInWithGithub()`
   - サインアウト Server Action: 同ファイルに `signOut()`
   - OAuth コールバック: `app/api/auth/callback/route.ts`（`exchangeCodeForSession` 実行・成功時はトップへリダイレクト）

4. **ユーザープロフィールアクセス層**
   - `src/types/user.ts` に `UserProfile` 型
   - `src/repositories/user-profile-repository.ts` に `findById` / `findByIdOrThrow`
   - 取得結果は snake_case → camelCase に変換して Service / Presentation 層に返す
   - 当面 Service Layer は不要（取得のみ・ロジック無し）。後続機能で必要になったら追加

5. **UI 反映**
   - `components/header.tsx` を新規作成（ロゴ + 認証 UI を内包）
   - 未ログイン: 「GitHub でログイン」ボタン（Server Action 経由）
   - ログイン済: アバター + 表示名 + ログアウトボタン
   - `app/(site)/layout.tsx` を `<Header />` を使う形に更新
   - `app/(site)/page.tsx` を「画像登録するにはログインが必要です（未ログイン）/ ようこそ {表示名} さん（ログイン済）」の最小プレースホルダに差し替え

6. **テスト**
   - `tests/unit/lib/errors.test.ts` に `UnauthorizedError` / `ForbiddenError` のケース追加
   - `tests/unit/repositories/user-profile-repository.test.ts` を新規作成（Supabase Client をモック）
   - `tests/unit/lib/auth/actions.test.ts` で Server Action の正常系と redirect 呼び出しを検証
   - `tests/e2e/auth.test.ts` で「未ログイン時に『GitHub でログイン』ボタンが表示される」E2E（実際の OAuth 遷移は対象外）

7. **ドキュメント更新**
   - `docs/glossary.md` のエラー一覧に `UnauthorizedError` / `ForbiddenError` を追記
   - 必要に応じて `docs/development-guidelines.md` の認証関連サンプルを実装に合わせて微修正
   - 必要に応じて `docs/repository-structure.md` のディレクトリ追記（`middleware.ts` / `src/lib/auth/` を反映）

8. **ローカル動作確認のための設定整備**
   - `supabase/config.toml` に `[auth.external.github]` を `enabled = true` で追記し、`env(GITHUB_OAUTH_CLIENT_ID)` / `env(GITHUB_OAUTH_CLIENT_SECRET)` を参照
   - `README.md` に GitHub OAuth App 登録手順（callback URL `http://localhost:54321/auth/v1/callback`）を追記

### 含まないもの

- 画像登録 / 削除 / 一覧 / お気に入り機能の実装本体（別 `/add-feature` で扱う）
- 管理者ロール（`is_admin`）の判定ロジックや管理者画面（P1 機能）
- ユーザープロフィール編集画面（PRD スコープ外）
- GitHub 以外の OAuth プロバイダ対応（PRD スコープ外）
- セッション期限切れ時の高度な UI（簡易表示のみ）
- 本番 Vercel 環境への OAuth Callback URL 設定（運用ドキュメント側で扱う）

## 成功条件

- [ ] `npm run lint` がエラーなしで通る
- [ ] `npm run typecheck` がエラーなしで通る
- [ ] `npm test` が新規ユニットテストを含めてすべて pass する
- [ ] `npm run dev` でトップページが 200 を返し、未ログイン状態で「GitHub でログイン」ボタンが表示される
- [ ] `supabase/migrations/20260503000000_create_user_profiles.sql` がローカルの `supabase db reset` で正常適用される
- [ ] PRD #3「GitHub OAuth 認証」の受け入れ条件 5 項目（OAuth 可・プロフィール表示・未ログイン閲覧可・ログイン誘導ボタン・Supabase セッション）が説明可能
- [ ] `docs/glossary.md` に `UnauthorizedError` / `ForbiddenError` が記載されている

## 制約

- `docs/` 既存ドキュメントの構造変更は最小限（追記中心）
- `1PR = 1 つの関心事`: GitHub OAuth 認証のみ。画像機能・お気に入り機能を混ぜない
- `as` キャスト禁止（`development-guidelines.md` 規約）。Supabase 行型は `.returns<T>()` または明示的な mapper 関数で扱う
- `any` 禁止
- セッション管理は Supabase Auth に委譲し、独自の JWT 管理は実装しない
- middleware の matcher は静的アセット（`_next/static` 等）を除外し、過剰な処理を避ける
- 本フェーズではユーザープロフィール更新（`displayName` / `avatarUrl` の差分同期）は行わず、`auth.users` INSERT トリガによる初回作成のみで完結させる
