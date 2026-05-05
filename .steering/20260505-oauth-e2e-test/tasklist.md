# タスクリスト: OAuth コールバックの E2E テスト追加

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: テスト専用 sign-in API

- [x] T1-1 `app/api/auth/test-signin/route.ts` を新設
  - `process.env.E2E_TEST_MODE !== 'true'` のとき 403
  - `POST` のみ受理 (それ以外は 405)
  - body は Zod で `{ email: string, password: string }` バリデーション → 不正なら 400
  - `createServerClient` を `@supabase/ssr` で構築 (callback route と同パターン)
  - `signInWithPassword` 失敗で 401、成功で 200 + cookie が response にセット
- [x] T1-2 `tests/unit/api/auth-test-signin.test.ts` を新設
  - `E2E_TEST_MODE` 未設定で 403
  - `POST` 以外で 405
  - body 不正で 400
  - signInWithPassword 成功で 200
  - signInWithPassword エラーで 401

## フェーズ 2: Playwright globalSetup

- [x] T2-1 `tests/e2e/global-setup.ts` を新設
  - 必須環境変数を fail-fast で検証 (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`)
  - admin client で既存テストユーザーがあれば削除 → 新規作成 (idempotent)
  - `request.newContext({ baseURL })` で `/api/auth/test-signin` に POST、cookie を session に立てる
  - `request.storageState({ path: 'tests/e2e/.auth/user.json' })` で書き出し
- [x] T2-2 `.gitignore` に `/tests/e2e/.auth/` を追加

## フェーズ 3: playwright.config.ts 改修

- [x] T3-1 `globalSetup: './tests/e2e/global-setup.ts'` を追加
- [x] T3-2 `projects` を 2 系統に分割
  - `chromium` (未ログイン): `testIgnore: ['**/auth-callback.test.ts']`
  - `authenticated` (ログイン済み): `use.storageState`, `testMatch: ['**/auth-callback.test.ts']`
- [x] T3-3 `webServer.env` に `E2E_TEST_MODE: 'true'` を追加 (既存の env を継承する形)

## フェーズ 4: 認証済み E2E テスト

- [x] T4-1 `tests/e2e/auth-callback.test.ts` を新設
  - ログイン済みヘッダー (アバター / 表示名 / 「画像を登録する」リンク / ログアウトボタン) を assert
  - トップページから「GitHub でログイン」「ログインして登録」が消えていることを assert
  - `/images/new` に直接アクセスしてもリダイレクトされない (URL が維持される)

## フェーズ 5: CI ワークフロー改修

- [x] T5-1 `.github/workflows/ci.yml` の e2e ジョブで `SUPABASE_SERVICE_ROLE_KEY` を `$GITHUB_ENV` に追加 (`supabase status -o json` から `SERVICE_ROLE_KEY` を取得)
- [x] T5-2 `npm run test:e2e` ステップに `env: E2E_TEST_MODE: 'true'` を追加 (build 側は不要、webServer.env で渡る)

## フェーズ 6: ドキュメント

- [x] T6-1 `README.md` に E2E ローカル実行手順を追記
  - `npm run db:start` で Supabase Local を起動
  - `supabase status` で `SERVICE_ROLE_KEY` を取得 → `.env.local` に `SUPABASE_SERVICE_ROLE_KEY=...` と `E2E_TEST_MODE=true` を追記する手順
  - `npm run test:e2e` の実行
- [x] T6-2 `docs/development-guidelines.md` の「E2E テスト」セクションに `storageState` パターンを追記

## フェーズ 7: 品質チェック

- [x] T7-1 `npm run lint` がエラー無しで通る
- [x] T7-2 `npm run typecheck` がエラー無しで通る
- [x] T7-3 `npm test` (ユニット + 統合) がエラー無しで通る
- [x] T7-4 ローカルで `npm run test:e2e` を実行して全 green を確認 (Supabase Local 起動済み + `.env.local` 設定済み前提)

## フェーズ 8: 実装検証

- [x] T8-1 `implementation-validator` サブエージェントで全実装を検証し、指摘があれば解消する

## フェーズ 9: 振り返り

- [x] T9-1 本ファイル末尾の「実装後の振り返り」を更新 (実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案)
- [x] T9-2 永続ドキュメント (`docs/`) で更新が必要な箇所があるか判断し、必要なら更新する

---

## 実装後の振り返り

### 実装完了日

2026-05-06

### 実装サマリー

PR #2 の OAuth コールバックで未自動化だった「`exchangeCodeForSession` 成功パス後の UI」を Playwright `storageState` 方式で E2E カバーした。本物の GitHub OAuth サーバーを使わず、Supabase Local の Admin API でテストユーザーを idempotent に作成し、E2E 限定エンドポイント `/api/auth/test-signin` 経由で `@supabase/ssr` 互換の cookie を立てる構成で、CI でも安定 green を達成。

- **新規ルート**: `app/api/auth/test-signin/route.ts` (E2E_TEST_MODE 限定の email/password sign-in)
- **新規 globalSetup**: `tests/e2e/global-setup.ts` (Admin API + storageState 生成)
- **新規 E2E**: `tests/e2e/auth-callback.test.ts` (3 シナリオ: 認証済みヘッダー / 誘導 UI 非表示 / 未ログインリダイレクトされない)
- **playwright.config.ts**: 2 プロジェクト (`chromium` / `authenticated`) 体制に変更、`webServer.env` で `E2E_TEST_MODE=true` を webServer プロセスにのみ渡す
- **CI**: e2e ジョブで `SUPABASE_SERVICE_ROLE_KEY` を `$GITHUB_ENV` に追加
- **ドキュメント**: `README.md` の「E2E テスト」節 / `docs/development-guidelines.md` の `storageState` パターン節

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| `E2E_TEST_MODE` を CI ステップでも明示する | 当初は build / test:e2e ステップ両方で `env: E2E_TEST_MODE=true` を指定する案 | implementation-validator の指摘で **CI ステップの env を削除し、`webServer.env` 一本化** に変更 (二重設定を避ける) |
| 401 エラーレスポンスの内容 | `{ error: 'signin_failed', message: error?.message }` で内部メッセージを返す | implementation-validator の指摘で **`{ error: 'signin_failed' }` に絞り、Supabase メッセージを露出しない**よう修正 (E2E 限定とはいえセキュリティ一貫性) |
| `listUsers` のページネーション | 既定 (perPage=50) のまま | implementation-validator の指摘で **`perPage: 1000` を明示** (CI 以外の環境で長期運用時の取りこぼし防止) |
| `STORAGE_STATE_PATH` の定義場所 | playwright.config.ts と global-setup.ts で個別定義 | implementation-validator の指摘で **global-setup.ts から export を import して single source of truth** に統一 |
| ユニットテスト件数 | 4 ケース (403 / 400 / 200 / 401) | 5 ケース (403 / 400 / 200 / 401 / user 不在 401) — 境界ケースを追加 |

### 学んだこと

1. **GitHub OAuth フロー全体は E2E にしない**: 外部 IDP に依存させると CI 不安定化の温床。コールバック後に**何が見えるか**を検証するのが ROI 上もっとも高く、`storageState` + email/password sign-in で同等の cookie を立てる方法で十分カバーできる
2. **Playwright プロジェクトはファイル単位で振り分けるのが安全**: `test.use({ storageState: ... })` を describe / test 内で切り替えるよりも、`testIgnore` / `testMatch` でファイル単位に分離した方が「このファイルは認証済み前提」が明示的になり事故が減る
3. **`isE2ETestMode()` を関数化する**: モジュールロード時の `process.env` 評価を避け、リクエスト時評価にすることで、Vitest のモジュールキャッシュを跨いでも各テストケースで `E2E_TEST_MODE` の差し替えが効く (`vi.resetModules()` 不要)
4. **Playwright の `webServer.env` は process.env にマージされる**: `{ ...process.env, ...config.env }` の挙動なので、PATH / NODE_ENV など必要な環境は失われない。CI ステップでの env 重複設定は不要
5. **`@supabase/ssr` の cookie 自前構築は脆い**: `sb-${storageKey}-auth-token` 形式や chunk 化に追従するメンテコストが高い。Server Component 互換の `createServerClient` + `signInWithPassword` の副作用で cookie を立てる方が安全
6. **`request.newContext` + `request.storageState` だけで storageState 化できる**: ブラウザ起動 (`chromium.launch`) は不要。API リクエストコンテキストだけで cookie を取って書き出せる

### 次回への改善提案

1. **削除ボタン / 削除 API E2E (P0 #2 の出口)**
   - 詳細ページに `<DeleteButton>` を載せた段階で、`tests/e2e/image-delete-authenticated.test.ts` を追加。一覧 → 詳細 → 削除 → 一覧消滅の流れを `authenticated` プロジェクトで検証
   - storageState の再利用パターンの最初の応用例になる

2. **お気に入りボタン / お気に入り一覧 E2E (P0 #4-A,B の出口)**
   - 認証済み + 未認証で挙動が変わるので、`authenticated` プロジェクトと `chromium` プロジェクトで個別に検証ケースを書く
   - `favorites` テーブルのマイグレーションが入った段階で、Repository / Service / API / UI / E2E をまとめて 1 PR で出す方針

3. **テストユーザー生成のロール拡張**
   - `is_admin = true` のテストユーザーが必要になったら、`globalSetup` で 2 ユーザー (`e2e-user@` / `e2e-admin@`) を作って `storageState` も 2 ファイル化する
   - そのタイミングで `global-setup.ts` を `setupTestUser({ email, isAdmin })` のような関数に切り出す

4. **`/api/auth/test-signin` の本番混入対策の強化 (任意)**
   - 現状: `E2E_TEST_MODE !== 'true'` のとき 403。十分強いガードだが、念のため Vercel 本番デプロイ環境変数を CI の lint で grep してエラー化する仕組みを追加すると、ヒューマンエラーで `E2E_TEST_MODE=true` が本番に入る事故をさらに減らせる
   - PRD スコープ外なので必要に応じて検討

5. **ログイン済み E2E ファイル名の規約整備 (任意)**
   - 現在は `auth-callback.test.ts` (シナリオ名ベース)。今後ファイルが増えたら `<feature>-authenticated.test.ts` のように明示的なサフィックスを規約化するか、`tests/e2e/authenticated/` ディレクトリを切るかを再検討する
   - `playwright.config.ts` の `testMatch` を `tests/e2e/authenticated/**/*.test.ts` に変えればファイル名規約が不要になるので、ファイルが 3 件を超えるタイミングで切り替えるのが妥当

### 今回スコープ外として残したもの

- 削除 / お気に入りなど機能フローの認証済み E2E (該当機能の PR で個別追加)
- 本物の GitHub OAuth サーバーをモック化した統合テスト (Issue 内アプローチ B、ROI 低と判断済み)
- セッション期限切れ / refresh token rotation の E2E
- middleware の matcher 拡張やセッション更新まわりの仕様変更
- `auth.users` トリガー (`handle_new_user`) の改修
