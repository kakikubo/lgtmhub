# タスクリスト: GitHub OAuth 認証

## Phase 1: DB スキーマ・型

- [x] T1-1 `supabase/migrations/20260503000000_create_user_profiles.sql` を作成（`user_profiles` テーブル / `set_updated_at` / `handle_new_user` / RLS ポリシー / `auth.users` トリガ）
- [x] T1-2 `supabase/config.toml` に `[auth.external.github]` を追記（env 参照、`enabled = true`）
- [x] T1-3 `src/types/user.ts` に `UserProfile` インターフェースを定義
- [x] T1-4 `src/types/database.types.ts` を作成（`user_profiles` 行型を最小手書き、`Database` 型は `npm run db:types` で再生成可能な形を保つ）

## Phase 2: 共通基盤コードの追加

- [x] T2-1 `src/lib/errors.ts` に `UnauthorizedError`（コード `UNAUTHORIZED`）/ `ForbiddenError`（コード `FORBIDDEN`）を追加
- [x] T2-2 `tests/unit/lib/errors.test.ts` に上記 2 クラスのテストケースを追加（既存 6 件 + 4 件追加。デフォルト/カスタムメッセージの両方を検証）

## Phase 3: ミドルウェア

- [x] T3-1 ルート直下に `middleware.ts` を作成（`createServerClient` + `getUser()` で session refresh、cookie 伝播、matcher で静的アセット除外）

## Phase 4: 認証フロー（Server Action / OAuth コールバック）

- [x] T4-1 `src/lib/auth/actions.ts` を作成（`'use server'`、`signInWithGithub` / `signOut`）
- [x] T4-2 `app/api/auth/callback/route.ts` を作成（`exchangeCodeForSession` + 成功時 redirect、失敗時 `?auth_error=...` redirect）
- [x] T4-3 `app/api/auth/callback/.gitkeep` を削除（`route.ts` 追加に伴い不要）

## Phase 5: ユーザープロフィールアクセス層

- [x] T5-1 `src/repositories/user-profile-repository.ts` を作成（`UserProfileRepository` クラス、`findById` / `findByIdOrThrow`、Database 型でジェネリクス指定）
- [x] T5-2 `tests/unit/repositories/user-profile-repository.test.ts` を作成（Supabase Client モック、null 返却 / 正常返却 / DB エラー / NotFound の 4 ケース・全 5 ケース）

## Phase 6: UI 反映

- [x] T6-1 `next.config.ts` の `images.remotePatterns` に `avatars.githubusercontent.com` を追加
- [x] T6-2 `components/header.tsx` を新規作成（Server Component、ログイン状態によって `sign-in` / `sign-out` フォーム切り替え、アバター + 表示名）
- [x] T6-3 `app/(site)/layout.tsx` を `<Header />` を使う形に更新
- [x] T6-4 `app/(site)/page.tsx` を「未ログイン: ログイン誘導 / ログイン済: ようこそ表示」プレースホルダに更新

## Phase 7: テスト追加

- [x] T7-1 `tests/unit/lib/auth/actions.test.ts` を作成（`next/navigation`・`next/headers`・Supabase Client をモック、`signInWithGithub` の成功 / 失敗 / `signOut` を検証）
- [x] T7-2 `tests/e2e/smoke.test.ts` を新トップページ仕様に合わせて更新（`scaffolding 完了` 文言から `GitHub でログイン` ボタン表示に）
- [x] T7-3 `tests/e2e/auth.test.ts` を新規作成（未ログイン時のログインボタン表示確認）

## Phase 8: ドキュメント更新

- [x] T8-1 `docs/glossary.md` の「エラー・例外」セクションに `UnauthorizedError` / `ForbiddenError` を追記し、A-Z 索引にも追加
- [x] T8-2 `docs/repository-structure.md` のプロジェクト構造ツリーに `middleware.ts` と `src/lib/auth/actions.ts` / `user-profile-repository.ts` を追記、関連説明を更新
- [x] T8-3 `README.md` に GitHub OAuth セットアップ手順を追記（GitHub OAuth App 作成 / Supabase Studio に Client ID・Secret を登録）

## Phase 9: 動作確認

- [x] T9-1 `npm run lint` がエラーなしで通る (ESLint: No issues found)
- [x] T9-2 `npm run typecheck` がエラーなしで通る
- [x] T9-3 `npm test` がすべて pass する (20 tests / 3 files: errors 10 + user-profile-repository 5 + auth/actions 5)
- [x] T9-4 `npm run dev` でトップページが 200、「LGTMHub」「GitHub でログイン」「ログインして登録」が描画される / `/api/auth/callback` の missing_code / exchange_failed redirect も確認

## Phase 10: 振り返り

- [x] T10-1 本ファイル末尾に「申し送り事項」を追記（実装日 / 計画と実績の差分 / 学んだこと / 次回への改善提案）

---

## 申し送り事項

### 実装完了日
2026-05-03

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| `src/types/database.types.ts` | 自動生成 | Docker / Supabase Local の起動コストを避けるため最小手書き。`npm run db:types` で再生成可能な構造を維持 |
| OAuth コールバックの `next` パラメータ | 単純に `searchParams.get('next') ?? '/'` | implementation-validator の指摘で **open redirect 対策** を追加 (`safeNext` ヘルパで `/` 始まり / `//` 除外) |
| Server Component から Repository 直接呼び出し | 設計時点で許容と判断 | implementation-validator の指摘を受け `docs/repository-structure.md` に **明文化された例外** を追記。Service 化が必要な条件も明記 |
| middleware で session refresh | `getUser()` のみ | 計画通り（matcher で静的アセット除外） |
| `.env.local` 作成 | 手順は README で説明 | 動作確認のため一時的に `.env.local` を作成し dev サーバー起動を確認後、削除（コミットには含めない） |
| auth.users INSERT トリガ | `security definer` + `set search_path = public` | 計画通り。`raw_user_meta_data ->> 'user_name'` が null の場合は early return（GitHub 以外の OAuth プロバイダ追加時に備える） |
| ユニットテスト件数 | errors 2 + repo 4 + actions 3 = 9 ケース追加 | errors 4 + repo 5 + actions 5 = 14 ケース追加（origin フォールバックや `data.url` null など境界ケースを充実） |

### 学んだこと

1. **`@supabase/ssr` v0.10 系の middleware パターン**: `cookies.getAll/setAll` 形式が必須。レスポンスへの cookie 伝播は `request.cookies.set` ではなく `response.cookies.set` だけで十分（middleware では `request` を再構築するパターンも公式にあるが、最小構成ならば `response.cookies.set` のみで動く）
2. **edge runtime での `process.env` 解決**: `.env.local` から読み込まれた値は middleware にも届く。シェル env はシェルから起動した `next dev` プロセスに継承されるが、edge runtime のサンドボックス次第で見えないケースがあるため、`.env.local` 経由が確実
3. **Supabase Auth の `auth.users` トリガ**: 初回サインアップ時のみ発火するため、後続のメタデータ更新（GitHub 側でアバター変更など）は反映されない。MVP では許容、将来 `UserProfileService.syncFromAuth(userId)` で OAuth コールバック内同期を検討
4. **Server Action と `redirect()` のテスト**: `next/navigation` を `vi.mock` でスタブし、`redirect` 内で意図的に throw させると呼び出し履歴と「redirect が呼ばれた事実」を同時に検証可能。Server Action 自体は throw を返り値とする想定なので tests 側で `rejects.toThrow` を使う
5. **`as` キャスト最小化**: Repository は `Database` 型をジェネリクス渡しにすると Supabase Client 側の戻り値が完全に型推論され、アプリ側に `as` が一切不要になる
6. **open redirect の盲点**: `new URL(relativeOrAbsolute, base)` は relative なら base 側に解決するが、絶対 URL なら base を無視する。`?next=https://evil.example` のような攻撃パスを封じるには明示的に `value.startsWith('/') && !value.startsWith('//')` でガードする必要がある

### 次回（画像登録機能 / お気に入り機能）への改善提案

1. **Supabase Local を起動した状態で `npm run db:types` を実行し、`src/types/database.types.ts` を再生成**
   - 現在は `user_profiles` のみ手書き。後続マイグレーション（`lgtm_images` / `favorites` / `daily_upload_counts`）では行数が増えるので自動生成が前提
   - 推奨フロー: `npm run db:start` → `npm run db:reset` → `npm run db:types` → diff レビュー → コミット

2. **`UserProfileService` の新設タイミング**
   - 画像一覧で投稿者表示（後続実装）が始まった時点で「複数の画像とその投稿者プロフィールを N+1 にせず取得する」要件が出る
   - そのタイミングで `UserProfileService.findManyByIds(ids)` などを追加し、Header / page.tsx の Repository 直呼び出しも Service 経由へ移行する

3. **OAuth コールバックの統合テスト**
   - 現状は callback の curl 動作確認のみ。Supabase Local + 仮 GitHub OAuth サーバー（`mock-server`）を使った統合テストの追加余地あり
   - ただし依存が増えるため、まずは E2E でログイン後の動作（既ログイン状態でのアバター表示）を Playwright `storageState` 機能でカバーする方が ROI は高い

4. **`development-guidelines.md` の Server Action サンプル追加**
   - Route Handler のサンプルはあるが Server Action（`'use server'`）のサンプルが未記載。OAuth 実装で確立したパターンをガイドラインに追記すると後続実装で迷いが減る

5. **CSRF 対策（Server Action）**
   - Next.js の Server Action は same-origin チェックが組み込みで効く（公式の保護機能）が、念のため `next.config.ts` の `experimental.serverActions.allowedOrigins` を本番ドメイン限定で設定する選択肢を後で検討

### scaffolding 範囲外として残したもの

- 画像登録 / 削除 / 一覧 / お気に入り API (P0 機能 #1, #2, #4, #5) — 個別 `/add-feature` で実装
- 管理者ロール (`is_admin`) を活用するロジック — P1 機能で対応
- ユーザープロフィール編集画面 — PRD スコープ外
- アバター更新の差分同期 — `auth.users` UPDATE 時のトリガ追加 or Service 同期で将来対応
