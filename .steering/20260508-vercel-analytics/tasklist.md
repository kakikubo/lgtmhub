# タスクリスト: Vercel Analytics / Speed Insights 導入

## 実装タスク

- [x] `@vercel/analytics` と `@vercel/speed-insights` を `npm install` で追加し、`package.json` / `package-lock.json` を更新する
- [x] `app/layout.tsx` を編集し、`<body>` 配下（`{children}` の直後）に `<Analytics />` と `<SpeedInsights />` をマウントする
- [x] `docs/architecture.md` の「モニタリング・可観測性」セクションを更新し、Vercel Analytics / Speed Insights を実装済みとして記載する

## 検証タスク

- [x] `npm run build` がエラーなく完了する
- [x] `npm run typecheck` がパスする
- [x] `npm run lint` がパスする
- [x] `npm test` がパスする

## 申し送り事項

### 実装完了

- 実装完了日: 2026-05-09
- 関連 Issue: [#70](https://github.com/kakikubo/lgtmhub/issues/70)

### 計画と実績の差分

- **`npm install` で `--legacy-peer-deps` が必要だった**: `@vercel/analytics@2.x` は `next` / `react` / `vue` / `svelte` / `@sveltejs/kit` / `nuxt` / `@remix-run/react` / `vue-router` を **optional peer** として宣言している。本来 `peerDependenciesMeta.optional: true` であれば npm が無視するが、npm 11 の strict 解決はインストール解析時に当該 peer を引き当てた他パッケージ（例: vitest 経由の vite）と衝突を発生させるため、フラグなしでは ERESOLVE で失敗した。lockfile 生成後の `npm ci` は通るため CI 影響はない。今後同種の依存（フレームワーク横断 SDK）を追加する際は `--legacy-peer-deps` 前提にする想定で OK。
- **`docs/architecture.md` の環境分岐記述を修正**: 設計時には `VERCEL_ENV` 判定と書いたが、実装検証（implementation-validator）でパッケージ実装を読んだ結果、`@vercel/analytics` は `process.env.NODE_ENV` を見ていることが判明。`development` ビルドでもデバッグ版スクリプトをロードしてイベント送信する挙動。`docs/architecture.md` を実態に合わせて更新済み。
- **Preview 環境の KPI フィルタを補足**: 検証で指摘された通り、`@vercel/analytics` は Preview デプロイでもイベントを送る。MAU 等の KPI を読む際は Vercel ダッシュボードで `environment = production` フィルタを適用する旨を `docs/architecture.md` に追記。

### 学んだこと

- **Optional peer の宣言があっても npm 11 は ERESOLVE する**: `peerDependenciesMeta.optional` は「無くてもよい」ことを示すだけで、すでに tree に存在すると衝突対象になる。フレームワーク横断 SDK（`@vercel/analytics` 等）を入れるときは `--legacy-peer-deps` か `.npmrc` を検討する。
- **設計書はパッケージ内部実装まで踏み込んで検証する**: 「`VERCEL_ENV` を見ているはず」のような推測ベースの記述は実装と乖離する。design.md の段階で `node_modules/@vercel/analytics/dist/next/index.mjs` を読んでおくべきだった。
- **biome.json の `!**/.claude/worktrees` ignore で worktree 内の `npm run lint` がスコープ外になる**: 直接 `./node_modules/.bin/biome lint <path>` を呼ぶか、ファイル指定で実行すれば OK。今後 worktree で作業する際の運用 Tips。

### 次回への改善提案

- `.npmrc` に `legacy-peer-deps=true` を入れるかは、他の依存追加時の挙動も含めて検討課題（今回は CI 通過を確認できたので保留）。
- worktree 環境で `npm run lint` が空走するのは UX が悪い。`biome.json` の ignore を `**/.claude/worktrees/*` ではなく親ディレクトリ側に集約する、あるいは worktree 用の `package.json` script を別途用意するなどで改善できる（別 Issue 候補）。
- `@vercel/analytics` の `track()` を使ったカスタムイベント計測（例: 画像登録成功 / お気に入り追加）は、KPI 設計が固まった段階で別タスクとして起票する。

