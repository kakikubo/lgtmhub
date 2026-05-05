# 設計: OAuth コールバックの E2E テスト追加

## アーキテクチャ概要

Playwright の `storageState` を活用し、E2E 実行時に「ログイン済み」のブラウザコンテキストを再現する。GitHub OAuth サーバーを実際に呼び出すのは現実的でないため、Supabase Local の Admin API で email / password ユーザーをテスト用に作成し、テスト専用の Server-side sign-in エンドポイント経由で `@supabase/ssr` の cookie を立てる。

```
┌─────────────────────┐
│ globalSetup (Node) │
│ ─────────────────── │
│ 1. admin.createUser  │ ─→ Supabase Local (auth schema)
│    (idempotent)      │     auth.users + handle_new_user trigger
│                      │     → public.user_profiles
│ 2. POST /api/auth/   │
│    test-signin       │ ─→ Next.js (E2E_TEST_MODE=true)
│    via Playwright    │     signInWithPassword
│    request context   │     → response.cookies に sb-...-auth-token
│ 3. context.          │
│    storageState()    │ ─→ tests/e2e/.auth/user.json
└─────────────────────┘
                  ▼
       ┌──────────────────────┐
       │ authenticated project │
       │ storageState 適用済み  │
       │ tests/e2e/auth-       │
       │ callback.test.ts      │
       └──────────────────────┘
```

## 主要コンポーネント

### 1. `app/api/auth/test-signin/route.ts` (新設)

**責務**: E2E_TEST_MODE 限定で email/password sign-in を許可し、`@supabase/ssr` 互換の session cookie を発行する。

**ガード**:
- `process.env.E2E_TEST_MODE !== 'true'` のとき 403 を返す。
- 本番ビルドでは `E2E_TEST_MODE` を一切渡さないため、誤って公開されてもガードで弾く。
- 念のため body に `password` を含むため `405 Method Not Allowed` で `GET` / `HEAD` を弾く (POST のみ受理)。

**処理フロー**:
1. `E2E_TEST_MODE` を確認、false なら `{ error: 'forbidden' }` で 403。
2. `request.json()` で `{ email, password }` を取得 (Zod でバリデーション)。
3. `createServerClient` を `@supabase/ssr` で構築 (callback route と同パターン)。
4. `supabase.auth.signInWithPassword({ email, password })`。
5. 失敗なら `{ error: 'signin_failed', message }` で 401。
6. 成功なら `{ ok: true, userId }` を 200 で返す (cookie は副作用で response にセット済み)。

**設計意図**:
- 本番への混入リスクを抑えるため、専用エンドポイントを設けて Server Action は使わない (Server Action は Next.js のリクエストすべてで分岐して動くため、誤起動の影響範囲が広がる)。
- `E2E_TEST_MODE === 'true'` 以外では即座に 403 を返すため、エンドポイント自体が存在しても本番では「使えない無害なルート」となる。

### 2. `tests/e2e/global-setup.ts` (新設)

**責務**: テストユーザーの idempotent な作成と `storageState` ファイル生成。

**処理フロー**:
1. `process.env.NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` を読み込み (未設定なら fail-fast)。
2. `createClient(url, serviceRoleKey)` で admin client を構築。
3. `admin.auth.admin.listUsers()` で既存テストユーザーを検索し、あれば `deleteUser` で削除 (`raw_user_meta_data` の差分で再作成時にコケるのを防ぐ)。
4. `admin.auth.admin.createUser` でテストユーザー作成。
   - `email`: `e2e-user@example.com` (固定)
   - `password`: ランダム生成 (Node.js の `randomBytes(16).toString('hex')`)
   - `email_confirm: true`
   - `user_metadata`: `{ user_name: 'e2e-test-user', full_name: 'E2E Test User', avatar_url: 'https://avatars.githubusercontent.com/u/0?v=4' }` — `handle_new_user` トリガが拾える形式
5. Playwright の `request.newContext({ baseURL })` で `/api/auth/test-signin` に POST し、cookie を session に立てる。
6. `request.storageState({ path: 'tests/e2e/.auth/user.json' })` で保存。
7. 後続テストが `storageState` を読み込めるようにファイル書き出し完了を確認。

**設計意図**:
- `request` API のみで完結させる (browser を起動しないので軽量)。
- テストユーザーを毎回再作成することで、前回のテストで発生した状態 (アップロード履歴等) を引きずらない。
- `password` をハードコードせずランダム化することで、誤って `.env.example` 等にコピペされても本番影響なし。

### 3. `playwright.config.ts` (改修)

**変更点**:
- `globalSetup: './tests/e2e/global-setup.ts'` を追加。
- `projects` を 2 つに分割:
  - `chromium` (既存テスト全て): `testIgnore: ['**/auth-callback.test.ts']`
  - `authenticated` (新テスト): `use.storageState: 'tests/e2e/.auth/user.json'`, `testMatch: ['**/auth-callback.test.ts']`
- `webServer.env` に `E2E_TEST_MODE: 'true'` を追加。

**設計意図**:
- `authenticated` プロジェクトと `unauthenticated` プロジェクトの cookie / storage を完全分離 (同一テストファイルで `test.use({ storageState: ... })` を切り替えるよりも、ファイル単位で分離する方が事故を防げる)。
- 既存の未ログインテストはすべて `chromium` (= unauthenticated) で動かし、影響をゼロにする。

### 4. `tests/e2e/auth-callback.test.ts` (新設)

**カバレッジ**:
| シナリオ | Assert |
|---------|--------|
| ログイン済みでヘッダーが表示される | `header-register-link` テキスト「画像を登録する」 / アバター画像 / 表示名「E2E Test User」 / ボタン「ログアウト」 |
| ログイン済みではトップページの未ログイン誘導が消える | `getByRole('button', { name: 'GitHub でログイン' })` `toHaveCount(0)` / `getByRole('button', { name: 'ログインして登録' })` `toHaveCount(0)` |
| `/images/new` への直接アクセスがリダイレクトされない | URL が `/images/new` のまま (`auth_error=login_required` が付かない) |

**設計意図**:
- `exchangeCodeForSession` 後に立つ session cookie で「結果として」何が見えるかを検証することで、callback route の成功パスを実質的にカバーする。
- DB 連携 (user_profiles 取得) も含めて検証されるため、トリガーや RLS の回帰検出にもなる。

### 5. `.github/workflows/ci.yml` (改修)

**変更点 (e2e ジョブのみ)**:
- `Export Supabase env to GITHUB_ENV` ステップに `SUPABASE_SERVICE_ROLE_KEY` を追加。
- `npm run test:e2e` 直前に `E2E_TEST_MODE: 'true'` を `env:` で渡す。
- `npm run build` にも `E2E_TEST_MODE: 'true'` を渡す (Next.js が API ルートを除外しないようにするため、ただし API ルート自体は `process.env` を実行時に読むだけなので build 時には不要。明示的に渡すのは webServer 側のみで OK)。

**設計意図**:
- 既存ジョブの動作 (Supabase Local 起動 / build → e2e) を維持しつつ、最小差分で対応。

### 6. `.gitignore` (追記)

```gitignore
# Playwright authenticated storage state (生成物)
/tests/e2e/.auth/
```

`tests/e2e/.auth/.gitkeep` で空ディレクトリのみコミットして storageState 自体は除外する… のではなく、「生成物だから commit しない」方針なので `.gitkeep` は不要。`.gitignore` だけで足りる。

## エラーハンドリング

| 事象 | 挙動 |
|------|------|
| `SUPABASE_SERVICE_ROLE_KEY` 未設定 | `globalSetup` 開始時に throw → e2e 全体が失敗 |
| `E2E_TEST_MODE !== 'true'` で `/api/auth/test-signin` を叩いた | 403 `{ error: 'forbidden' }` |
| Supabase Local が未起動 | admin API が ECONNREFUSED → globalSetup が throw |
| `storageState` 読み込み失敗 (auth project) | Playwright がプロジェクト初期化時に fail (テスト実行前) |
| 既存テストユーザー削除失敗 | listUsers → deleteUser を try/catch (404 相当は ok)、それ以外は throw |

## テスト戦略

### Unit テスト

- `tests/unit/api/auth-test-signin.test.ts`:
  1. `E2E_TEST_MODE !== 'true'` のとき 403 を返す
  2. `E2E_TEST_MODE === 'true'` で正常系 → signInWithPassword をモックして 200 を確認
  3. body 不正 (email 欠落 / password 欠落) で 400
  4. signInWithPassword エラーで 401

(Server-side route のテストは既存 `tests/unit/api/` パターンに合わせる。詳細は実装時に確認。)

### E2E テスト

- 上記 `tests/e2e/auth-callback.test.ts` の 3 シナリオ。
- 既存の未ログイン系 5 ファイル (auth / smoke / image-list / image-detail / image-register) はそのまま `chromium` プロジェクトで通る。

## 代替案検討と却下理由

| 代替案 | 却下理由 |
|--------|---------|
| Cookie を Node 側で直接生成 | `@supabase/ssr` v0.10 の chunk 化 / hash 化に追従するメンテコストが高い。実装内部に依存して脆い |
| `page.evaluate` で Browser 側に Supabase JS を注入 | CDN 依存はテスト不安定化の温床。ローカル bundle するなら相応の build infra が必要 |
| 本物の GitHub OAuth (`mock-server` 等) を立てる | Issue 文面の方針 B。CI コストと依存 (mockoauth サーバ Docker image など) が増えるため除外 |
| Server Action 経由で sign-in | Server Action は同一エンドポイントに収束するため、本番 / テストの境界が曖昧になる |

## ファイル変更一覧

新規:
- `app/api/auth/test-signin/route.ts`
- `tests/e2e/global-setup.ts`
- `tests/e2e/auth-callback.test.ts`
- `tests/unit/api/auth-test-signin.test.ts`
- `.steering/20260505-oauth-e2e-test/requirements.md`
- `.steering/20260505-oauth-e2e-test/design.md`
- `.steering/20260505-oauth-e2e-test/tasklist.md`

更新:
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `.gitignore`
- `README.md`
- `docs/development-guidelines.md`
