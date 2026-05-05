# 要求内容

## 概要

CI の e2e ジョブで Supabase Local (Supabase CLI による Docker スタック) を起動し、E2E テストを実 DB / 実 Auth / 実 PostgREST に向けて実行できるようにする。

## 背景

- 現在の e2e ジョブは `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` に placeholder 値 (`http://127.0.0.1:54321` / `ci-placeholder-not-a-real-key`) を渡している (`.github/workflows/ci.yml:46-54`)
- 結果として Server Component 内の `service.listImages()` などが `TypeError: fetch failed` を吐き、`[HomePage] failed to list images` などの DATABASE_ERROR ログが大量に出ている
- 既存 E2E は graceful degrade に救われて pass するが、本来は **本物の DB に対するシナリオ (ログイン → 画像登録 → 一覧反映 → 詳細遷移 → 削除) を CI で自動検証したい**
- 後続 PR (P0 #2 削除 / P0 #4 お気に入り) の E2E はログイン済みフローを検証する必要があり、本作業がその前提インフラとなる
- 前回ステアリング (`20260504-image-registration-form-ui` 改善提案 #2) でも「ログイン済みフローの E2E 自動化」が宿題として残されている

## 実装対象の機能

### 1. e2e ジョブで Supabase Local を起動

- `.github/workflows/ci.yml` の `e2e` ジョブに以下を追加:
  - `supabase/setup-cli@v1` で CLI をインストール
  - `supabase start` で Docker スタックを起動 (PostgreSQL + PostgREST + Auth + Storage + 他)
  - `supabase status -o json | jq` で動的に取得した実 anon key と URL を `$GITHUB_ENV` に書き出し、後続ステップ (build / start / test) に伝播
  - `supabase stop` を `if: always()` で実行してリソースリーク防止 (CI ランナーは使い捨てなので副次的)

### 2. 既存 E2E の動作を維持

- `tests/e2e/*.test.ts` のテスト本体は変更しない (今回スコープ外)
- DATABASE_ERROR ログが消えること、既存 8 ケース全て pass することを動作要件とする
- 「データが空でも一覧は empty state を表示する」という既存 E2E の挙動は、Supabase Local は seed が空のため引き続き empty 経路で pass する

## 受け入れ条件

### CI ジョブ

- [ ] `e2e` ジョブで `supabase start` が正常に完了する (Docker イメージ pull 含めてタイムアウトせず終わる)
- [ ] `supabase status` で取得した実 anon key と URL が `npm run build` / `npm start` / `npm run test:e2e` に伝播している
- [ ] `npm run test:e2e` が全ケース pass する (現状 1 skipped + 7 passed = 8 件、本作業後も同等以上の pass を維持)
- [ ] CI ログに `[HomePage] failed to list images` / `[ImageDetailPage] failed to load image` が出力されない

### ローカル開発への影響

- [ ] 既存の `npm run db:start` / `db:reset` のローカルワークフローに副作用が無い (CI 用の追加だけで `supabase/config.toml` には触らない)
- [ ] `supabase/seed.sql` を変更しないこと (既存の動作と一貫性を保つ)

## 成功指標

- CI の e2e ジョブで実 PostgreSQL に対する SQL が走り、DATABASE_ERROR ログが 0 件になる
- 後続 PR (削除 / お気に入り) で「ログイン済みユーザーが画像を登録 → 削除する」を **シードを足すだけ** で E2E 化できる状態にする (本 PR ではシード追加は行わない)

## スコープ外

このフェーズでは実装しません。後続 PR で対応します。

- ログイン済みユーザーを E2E でセットアップする fixture 整備 (Supabase Auth の test user 作成 + cookie 注入)
- `supabase/seed.sql` への画像 / ユーザーシード追加
- ログイン済みフローの E2E (削除・お気に入りなど)
- 統合テスト (`tests/integration/`) を Supabase Local 経由に切り替えること (現状 `test` ジョブは素の Postgres コンテナを使用しており、その方針は維持)
- Vercel Preview 環境向けの Supabase Branching セットアップ (CI とは別の話)
- CI の起動時間最適化 (Docker layer cache, GitHub Actions cache)。動作確認後に必要に応じて別 PR

## 参照ドキュメント

- `docs/architecture.md` - Supabase / Vercel の利用方針
- `docs/development-guidelines.md` - CI/CD パイプライン
- `.github/workflows/ci.yml` - 現行 CI 設定
- `supabase/config.toml` - Supabase Local の port 構成 (api: 54321 / db: 54322)
- `.steering/20260504-image-registration-form-ui/tasklist.md` - 改善提案 #2「ログイン済みフローの E2E 自動化」
