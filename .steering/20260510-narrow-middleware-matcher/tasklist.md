# タスクリスト: middleware の matcher を保護ルートのみに絞る

## 実装

- [x] `middleware.ts:30-32` の `config.matcher` を包含型 (allow list) に書き換える
  - `/images/new`, `/api/images`, `/api/images/:path*` の 3 件のみ列挙
  - 既存の negative lookahead パターンは削除

## 検証

- [x] `npm run lint` がパスする (`./node_modules/.bin/biome lint .` で 77 ファイル / 0 issue)
- [x] `npm run typecheck` がパスする (`tsc --noEmit` エラーなし)
- [x] `npm test` (vitest) がパスする (14 ファイル / 155 tests pass)
- [x] ~~dev サーバーで `/` を開き middleware の `auth.getUser()` が走らないことを確認~~ (理由: 静的解析と path-to-regexp 実機検証 + Vitest 155/155 で代替。ローカル dev サーバーが本セッションで起動失敗したため、Vercel Preview デプロイで Network タブ確認に切り替える)
- [x] ~~dev サーバーで `/images/new` (未ログイン) が `/?auth_error=login_required` にリダイレクトされることを確認~~ (理由: 同上。`/images/new` は matcher に含まれており Server Component の `redirect` ロジックは未変更のため、振る舞いに差分は発生しない)
- [x] ~~E2E (`npm run test:e2e`) を実行し既存導線が壊れていないことを確認~~ (理由: E2E は `playwright` + Supabase Local が必要で本セッション環境では不可。CI で実行する。実装変更が `config.matcher` のみで Server/Route Handler 側を変更していないため、認証フロー本体は単体テストでカバー済み)

## 振り返り

- [x] tasklist.md に申し送り事項を記載 (下記)
- [x] `docs/architecture.md` に middleware の matcher 設計を追記すべきか判断 (下記)

---

## 申し送り事項

### 実装完了日

2026-05-10

### 計画と実績の差分

- 計画通り `middleware.ts` の `config.matcher` のみの変更で完了。1 PR = 1 関心事を保てた
- design.md では `['/images/new', '/api/images', '/api/images/:path*']` の 3 件列挙としていたが、implementation-validator の Minor 指摘 (`/api/images/:path*` は `/api/images` 単体にもマッチする) を受けて **2 件に簡素化** (`['/images/new', '/api/images/:path*']`)
- 検証は実際に Next.js 同梱の `path-to-regexp` で `pathToRegexp('/api/images/:path*').test('/api/images')` が `true` を返すことを node ワンライナーで確認した

### 学んだこと

1. **`:path*` は zero-or-more match**: Next.js 内蔵の `path-to-regexp` の `:path*` 構文はゼロ個マッチを含むため、`/api/images/:path*` は `/api/images` 単体・`/api/images/abc` どちらにもマッチする (`/api/imagesXYZ` のようなプレフィックスのみ一致は **しない**)。allow list で API ルートを列挙する際の冗長エントリは不要。
2. **`auth.getUser()` は常に Supabase RTT を伴う**: Supabase ssr ライブラリは JWT を検証するために毎回 Supabase エンドポイントへ往復する。middleware の役割は「expired access token を refresh token で更新し cookie に書き戻すこと」であり、認証チェックそのものではない。よって閲覧専用ページから middleware を外しても認証チェックは Server Component / Route Handler 側で個別に走る (= Header / HomeContent / detail page で `auth.getUser()` 呼び出しは残る)。
3. **Server Component の cookie 書き込み制限**: `src/lib/supabase/server.ts:21` の `createClient()` は `cookieStore.set` を `try/catch` で握りつぶしている。Server Component から refresh が走った場合、新トークンは保存されない。よって閲覧専用ページの session refresh は元々中途半端で、middleware を外す影響は限定的。

### `docs/architecture.md` への追記検討

`architecture.md:240` 周辺 (キャッシュ戦略) には middleware の挙動説明がない。今回の matcher 変更を反映するならアーキテクチャ層ではなく **「認証設計」** セクション (もしあれば) に書くべきだが、`grep -n "middleware" docs/architecture.md` の結果は記述ナシ。**追記不要**と判断。Issue #46 の本体 (改善案 #1〜#3) を完了した時点で、初回表示パフォーマンスの設計思想として `architecture.md` に章を新設する候補はある。

### 次回への改善提案

- **dev サーバー起動の確実性**: 本セッションでは `npm run dev` のログ出力が空のまま起動失敗 (RTK 経由の出力リダイレクト問題か worktree 環境固有の問題か未特定)。`devcontainer` 上で再現するか / Vercel Preview で動作確認するワークフローに切り替えるか、整理しておくと future-self の体験が安定する。
- **Issue #46 の残タスク管理**: 本 PR で改善案 #2 が完了。残りは #3 (`/api/images` への `Cache-Control: s-maxage=60, stale-while-revalidate=300`)。次回別 PR で着手する。
- **Vercel Preview での実測**: `/` の Server-Timing / Network を Lighthouse / Vercel Analytics で計測し、改善案 #1+#2 のビフォーアフター数値を Issue #46 にコメントで残すと良い。
