# 設計書

## アーキテクチャ概要

GitHub Actions の `e2e` ジョブ内に Supabase CLI で Docker スタックを起動し、後続ステップ (build / test) に動的取得した接続情報を引き渡す。

```
[runner: ubuntu-latest]
  │
  ├─ checkout
  ├─ setup-node (24)
  ├─ npm ci
  ├─ supabase/setup-cli@v1   ← CLI を入れる
  ├─ supabase start           ← Docker で PostgreSQL + PostgREST + Auth + Storage 起動
  │                             migrations は CLI が自動適用
  ├─ supabase status -o env >> $GITHUB_ENV (整形して NEXT_PUBLIC_* に変換)
  ├─ playwright install
  ├─ npm run build            ← NEXT_PUBLIC_* を JS バンドルにインライン化
  ├─ npm run test:e2e         ← npm start 経由で Next.js が実 Supabase を叩く
  └─ supabase stop (if: always())
```

## コンポーネント設計

### 1. `.github/workflows/ci.yml` の e2e ジョブ改修

**責務**:
- Supabase CLI のインストール
- Supabase Local の起動 / 停止
- 動的に取得した接続情報を `$GITHUB_ENV` に書き出して後続ステップで使えるようにする

**実装の要点**:
- **CLI のインストール**: `supabase/setup-cli@v1` を使用 (公式の GitHub Action)。バージョンは `latest` で固定せず、安定版 (project の dev dep `supabase` の major version 2.x に合わせる) を明示しておくと再現性が上がる
- **起動**: `supabase start` を素直に呼ぶ。Docker は ubuntu-latest に標準でインストール済み
  - 起動時間は最初の Docker pull 込みで 60〜120 秒。CI 全体への追加コストとして許容
- **環境変数の引き継ぎ**: `supabase status -o json` の JSON から `API_URL` と `ANON_KEY` を `jq` で抽出し、`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 名で `$GITHUB_ENV` に追記する
  - placeholder の `env:` ブロックは削除する (動的に注入するので無くて良い)
  - `Next.js の NEXT_PUBLIC_*` はビルド時にインライン化されるため、`$GITHUB_ENV` に書き出すタイミングは `npm run build` より前である必要がある
- **クリーンアップ**: `supabase stop` を `if: always()` で実行。CI ランナー使い捨てのため絶対必須ではないが、将来 self-hosted ランナー化したときの予防として入れる

### 2. supabase 起動時の OAuth env var 不足への対処

`supabase/config.toml` の `[auth.external.github]` が `env(GITHUB_OAUTH_CLIENT_ID)` / `env(GITHUB_OAUTH_CLIENT_SECRET)` を参照している。これらは CI で未設定だが、

- Supabase CLI は OAuth secret が空でも warning 程度で起動を継続する (= 起動阻害要因にはならない)
- 本作業の E2E は未ログインフローのみで GitHub OAuth を実際に叩かない

ため、CI では空文字を明示的に渡しておく (`env: GITHUB_OAUTH_CLIENT_ID: ""` を job レベルに置く)。これで warning も出にくくなる。

### 3. Supabase Local の anon key の取得方法

`supabase status -o json` の出力例 (CLI 2.x):
```json
{
  "API_URL": "http://127.0.0.1:54321",
  "DB_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  "STUDIO_URL": "http://127.0.0.1:54323",
  "INBUCKET_URL": "http://127.0.0.1:54324",
  "JWT_SECRET": "...",
  "ANON_KEY": "eyJhbGciOi...",
  "SERVICE_ROLE_KEY": "eyJhbGciOi..."
}
```

**実装**:
```bash
SUPABASE_STATUS=$(supabase status -o json)
echo "NEXT_PUBLIC_SUPABASE_URL=$(echo "$SUPABASE_STATUS" | jq -r '.API_URL')" >> "$GITHUB_ENV"
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$SUPABASE_STATUS" | jq -r '.ANON_KEY')" >> "$GITHUB_ENV"
```

`jq` は ubuntu-latest に標準でインストール済み。`-o json` は CLI 2.x で安定したオプション。

## データフロー

### CI e2e ジョブ実行
```
1. checkout / setup-node / npm ci
2. supabase/setup-cli インストール
3. supabase start
   - Docker イメージ pull (postgres / kong / gotrue / postgrest / realtime / storage / studio)
   - migrations 自動適用 (supabase/migrations/*.sql)
   - seed 自動適用 (supabase/seed.sql, 現状ほぼ空)
4. supabase status -o json で接続情報を取得 → $GITHUB_ENV
5. playwright install
6. npm run build (NEXT_PUBLIC_* がバンドルにインライン化)
7. npm run test:e2e (内部で npm start → 実 Supabase を叩く)
8. supabase stop (cleanup, always)
```

## エラーハンドリング戦略

### 想定される失敗
| 現象 | 原因 | 対策 |
|------|------|------|
| `supabase start` がタイムアウト | Docker イメージ pull に失敗 / health check 通らず | CLI が exit code !=0 で終わるので、step 自体が失敗。リトライ機構は今回入れない (CI の通常リトライで対処) |
| `supabase status` が JSON を返さない | CLI バージョン非互換 | バージョンを明示固定して防ぐ |
| anon key が空文字 | 抽出失敗 | `set -euo pipefail` で早期失敗させ、fallback 値は使わない (placeholder に戻ると意味がないため) |

### 既存 E2E への影響

- `tests/e2e/image-list.test.ts` の「画像グリッド / empty / error のいずれかが見える」アサートは、Supabase Local が空 DB で動くため `empty` 経路で pass する
- `tests/e2e/auth.test.ts` / `image-register.test.ts` / `smoke.test.ts` は未ログインフローのみで pass を維持
- `tests/e2e/image-detail.test.ts` の「一覧から先頭サムネイル」は empty 時に skip 経路を持っているのでそのまま動く (PR #25 マージ後)

## テスト戦略

### CI で確認 (本作業の検証手段)
- `e2e` ジョブが緑 (全 8 ケース pass)
- ジョブログに `DATABASE_ERROR` / `[HomePage] failed to list images` / `[ImageDetailPage] failed to load image` が現れない

### ローカル検証
- `act` などで GitHub Actions をローカル再現することはせず、push して Actions 上で確認する
- 個別ステップ (`supabase start` → `supabase status -o json`) を手元で確認することは可能だが、devcontainer 内で実行するためコスト高。push 確認に絞る

## 依存ライブラリ

- 新規追加なし (`supabase` CLI は既に `package.json` の devDependencies にあるが、CI では `supabase/setup-cli@v1` 経由で別途入れる方針)

## ディレクトリ構造

```
.github/workflows/ci.yml   (改修: e2e ジョブのみ)
.steering/20260505-ci-supabase-local/
  ├─ requirements.md
  ├─ design.md
  └─ tasklist.md
```

## 実装の順序

1. `.github/workflows/ci.yml` の e2e ジョブを書き換え
2. push して CI で動作確認
3. 失敗したら原因を切り分け (CLI version / supabase start の log / env var 抽出)
4. 緑になったら振り返り + ドキュメント整備

## セキュリティ考慮事項

- Supabase Local の anon key はテスト用 JWT であり、production には影響しない
- `GITHUB_OAUTH_CLIENT_*` を空文字で渡す: 実際の OAuth コールバック試験を CI で行わないため、本物のシークレットを CI に置く必要はない
- 本変更は production / preview デプロイには触らない (CI ジョブのみの変更)

## パフォーマンス考慮事項

- Supabase 起動コストで e2e ジョブが +60〜120 秒長くなる
- 現状 e2e ジョブは ~3 分程度なので、改修後は ~4〜5 分の見込み。許容範囲
- 将来短縮するなら GitHub Actions cache で Docker layer をキャッシュする (本 PR では行わない)

## 将来の拡張性

- 本作業で「CI に Supabase Local がある」状態を確立すれば、後続 PR で以下が容易になる:
  - `supabase/seed.sql` にテストユーザー / 画像を投入し、ログイン済み E2E を書く
  - `tests/integration/` を素の Postgres ではなく Supabase 経由に切り替えて RLS まで検証する (要否は別途検討)
  - Edge Functions のローカル動作検証
