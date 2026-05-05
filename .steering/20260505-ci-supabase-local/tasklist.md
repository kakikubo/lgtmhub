# タスクリスト: CI に Supabase Local を導入

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: CI ワークフローの改修

- [x] T1-1 `.github/workflows/ci.yml` の `e2e` ジョブから placeholder の `env:` ブロックを削除
- [x] T1-2 同ジョブに `supabase/setup-cli@v1` を追加 (version は明示: 2.0.0)
- [x] T1-3 `supabase start` ステップを追加
- [x] T1-4 `supabase status -o json` で取得した `API_URL` / `ANON_KEY` を `$GITHUB_ENV` に書き出すステップを追加
- [x] T1-5 `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` を空文字で job レベルに渡す (Supabase 起動時の warning 抑制)
- [x] T1-6 `supabase stop` を `if: always()` で末尾に追加 (cleanup, --no-backup 付き)
- [x] T1-7 ステップの順序が「supabase start → status 抽出 → playwright install → build → test:e2e → stop」になっていることを確認

## フェーズ 2: CI での動作確認

- [x] T2-1 ブランチを push して CI を実行 (PR #28 の run 25360143092)
- [x] T2-2 `e2e` ジョブが緑になることを確認 (security / lint-and-typecheck / test / e2e すべて success, 7 passed)
- [x] T2-3 ジョブログに `DATABASE_ERROR` / `failed to load image` が 0 件であることを確認 (grep でカウント = 0)
- [x] T2-4 失敗時は原因を切り分けて修正し、再 push する (該当なし。一発で緑)

## フェーズ 3: ドキュメント更新

- [x] T3-1 `docs/development-guidelines.md` の「CI/CDパイプライン」節 (もし `e2e` ジョブの説明があれば) を更新
- [x] T3-2 `.github/workflows/ci.yml` 内のコメント (lines 46-51 にあった placeholder の説明) を実情に合わせて書き換え

## フェーズ 4: 振り返り

- [x] T4-1 本ファイル末尾の「実装後の振り返り」を更新
  - 実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
2026-05-05

### 実装サマリー

- e2e ジョブで `supabase/setup-cli@v1` (v2.98.0 ピン止め) + `supabase start` を実行し、本物の PostgreSQL + PostgREST + Auth + Storage + Studio を Docker で起動
- `supabase status -o json` から `API_URL` と `ANON_KEY` を `jq -er` で抽出し、`$GITHUB_ENV` に書き出して `npm run build` 以降に伝播
- placeholder env (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` / `NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder-not-a-real-key`) を撤去
- `supabase stop --no-backup` を `if: always()` で末尾に追加
- `docs/development-guidelines.md` の CI/CD パイプライン例も同方針に追従

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| CLI バージョン | 当初 `2.0.0` (適当に指定) | ローカル devcontainer の CLI 実バージョンに合わせて `2.98.0` に修正 (再現性向上) |
| `supabase stop` のオプション | 計画では未明記 | `--no-backup` を付けて backup 確認プロンプトを抑止 |
| CI 一発緑 | `verification` で「失敗時は原因切り分け」を覚悟していた | T2-4 は不要 (一発で緑、e2e 全 7 ケース pass、DATABASE_ERROR 0 件) |

### 学んだこと

**技術的な学び**:
1. **`NEXT_PUBLIC_*` は build 時インライン化なので env 注入のタイミングが重要**: `supabase start` → `supabase status` → `$GITHUB_ENV` 書き出し → `npm run build` の順を厳守する必要がある。`npm run start` 直前に env を入れても遅い (バンドルに古い値が固まっている)。これが今回の設計ポイント
2. **`supabase status -o json` は安定 API**: `API_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` などの key は CLI 2.x 系で互換が保たれている。`jq -er` (`-e` で null/false 時に exit non-zero) を組み合わせれば抽出失敗を早期に検知できる
3. **`supabase start` の所要時間は CI で 60〜90 秒程度**: 当初「最大 2 分」と見込んだが実測で 70 秒 (Docker pull + health check 含む)。Docker layer cache を CI で効かせれば短縮できるが、現状は不要レベル
4. **`auth.external.github` の env() 参照は CI 環境で空文字でも問題なし**: `supabase/config.toml` は `env(GITHUB_OAUTH_CLIENT_ID)` を参照しているが、未設定 (空文字) でも CLI は warning すら出さずに起動する。OAuth コールバックを CI で叩かない限り問題にならない

**プロセス上の改善点**:
1. **「動的に取得した値を `$GITHUB_ENV` に書き出す」パターンの再利用性**: 今回確立した `set -euo pipefail; status=$(...); jq -er ... >> "$GITHUB_ENV"` のパターンは、将来 Vercel Blob Token や別サービスの env を CI で動的取得する場合にもそのまま流用できる。development-guidelines.md にスニペット化しておくと良いかもしれない (本作業ではスコープ外)
2. **CLI バージョンを実環境に合わせる重要性**: 「適当に `2.0.0` で OK」と当初決めたが、実際は `^2.0.0` の範囲内で v2.0.0 から v2.98.x まで API/出力が大きく変わっている。devcontainer の CLI と同じ MINOR バージョンに合わせると CI とローカルの挙動差を最小化できる

### 次回への改善提案

1. **PR #25 の rebase**: 本 PR がマージされたら、`feature/image-detail-page` (PR #25) を `main` にリベースすると、PR #25 の e2e でも DATABASE_ERROR が消える。コード変更は不要、CI 設定の変更を取り込むだけ
2. **シードデータの投入 (別 PR)**: 現状は空 DB で「empty state」経路で E2E が pass している。次は `supabase/seed.sql` にテストユーザー (auth.users + user_profiles) と画像数件を投入し、image-list / image-detail の "データあり" 経路を E2E でカバーする
3. **ログイン済みフロー fixture 整備 (別 PR)**: シードのテストユーザーに対応する Supabase Auth セッションクッキーを Playwright `globalSetup` で作る。これで「画像登録 → 削除 → お気に入り」の操作系シナリオを CI で回せるようになる
4. **CI の起動時間最適化 (任意)**: 現状 e2e ジョブは ~5 分。Supabase 起動 70 秒の内訳のうち Docker pull が大半。GitHub Actions cache + `actions/cache` で Docker layer をキャッシュすれば 30 秒程度に圧縮可能。費用対効果が見合うようになったら検討
5. **e2e ジョブの env を job レベルで集約**: 現状 `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` は job レベルに置いているが、`NEXT_PUBLIC_SUPABASE_*` は step が `$GITHUB_ENV` に書き出している。両者を整理する余地あり (現状で十分動くので必須ではない)

### 今回スコープ外として残したもの

- ログイン済みユーザー fixture (Playwright globalSetup での Supabase Auth セッション作成)
- `supabase/seed.sql` への画像 / ユーザー投入
- ログイン済みフローの E2E (削除 / お気に入りなど)
- 統合テスト (`tests/integration/`) を Supabase Local 経由に切り替え (現状 `test` ジョブの素 Postgres 方針を維持)
- Vercel Preview 向けの Supabase Branching セットアップ (CI とは別の話)
- CI Docker layer cache 化
