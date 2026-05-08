# タスクリスト: vercel.json 新規作成

## タスク

- [x] `vercel.json` を新規作成（`$schema` + 4種のセキュリティヘッダ）
- [x] `docs/architecture.md` の「セキュリティアーキテクチャ > データ保護」にレスポンスヘッダの記述を追記
- [x] `npm run build` がエラーなしで完了することを確認
- [x] `npm run lint` がエラーなしで完了することを確認 (worktree 配下では biome の `!**/.claude/worktrees` 除外で `npm run lint` 自体はスキップされるため、`npx --no -- biome check vercel.json` で個別検証。format 後に no-issue 確認済み)
- [x] `npm run typecheck` がエラーなしで完了することを確認
- [x] `npm test` が全てパスすることを確認 (153/153 pass)

## 申し送り事項

### 実装完了日
2026-05-08

### 計画と実績の差分
- 計画通り。`vercel.json` 新規作成と `docs/architecture.md` 1行追記のみで完結。
- 実装途中で `implementation-validator` の指摘を受け、`Permissions-Policy` に `payment=()` を追加（要件 / 設計 / 実装すべて反映）。CSP 導入時の `frame-ancestors` 注記も `design.md` に追記。
- biome の `lineWidth: 100` 制約により `Permissions-Policy` 行を 1 行で書くと超過するため、`biome format --write` で自動整形して 4 行展開した。CIで失敗しないようコミット前に整形済み。

### 学んだこと
- Vercel `headers` ルールは `source: "/(.*)"` で全パスに適用できる。Vercel Blob は別ドメイン配信なので本ファイルの影響は受けない（Blob の Cache-Control は SDK 個別設定）。
- Vercel が `*.vercel.app` 配下に HSTS を自動付与するため、`vercel.json` 側で `Strict-Transport-Security` を二重指定すると後勝ちで Vercel デフォルトより緩い値が反映されるリスクがある。今回は明示しない判断が正解。
- Next.js の `headers()` (`next.config.ts`) と `vercel.json` の `headers` の二重定義は **Vercel 側が後勝ちで上書き** する。今回は `next.config.ts` 側に同種ヘッダ無しを確認済み。
- worktree 配下から `npm run lint` を実行すると biome の `!**/.claude/worktrees` 除外でファイル全スキップされる（既知問題）。今回は `npx --no -- biome check vercel.json` で個別検証した。

### 次回への改善提案
- Issue #65 の残タスクを順次着手：
  1. ✅ `vercel.json` 新規作成（本タスク）
  2. ⬜ 環境変数の運用ルールを `docs/development-guidelines.md` に追記（`vercel env pull` を正規手段に）
  3. ⬜ `supabase/config.toml` に `[auth]` / `[auth.external.github]` / `[storage.buckets.*]` を記述
  4. ⬜ `supabase-deploy.yml` に `supabase config push --linked` ステップ追加
- CSP は別タスク化済みの認識。Next.js middleware で nonce ベースの CSP を導入する設計を切り出して issue 化したい。
- 上記とは独立に、worktree からの biome 実行スキップ問題は `biome.json` の `includes` パターン調整で解消可能。Issue #65 のスコープ外なので別途検討。
