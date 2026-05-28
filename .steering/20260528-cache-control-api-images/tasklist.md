# タスクリスト: `/api/images` GET の CDN キャッシュ対応 (Issue #46 案 #3)

## 実装タスク

### コード変更

- [ ] T1. `app/api/images/route.ts` GET ハンドラの import を `createClient` → `createAnonClient` に変更
- [ ] T2. `app/api/images/route.ts` GET ハンドラ内の `await createClient()` を `createAnonClient()` (同期) に置換
- [ ] T3. `app/api/images/route.ts` GET 成功レスポンスに `headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=300' }` を追加
- [ ] T4. `middleware.ts` 本体の冒頭に GET `/api/images` ショートサーキットを追加 (コメントで `Issue #46 案 #3` の意図を残す)

### テスト

- [ ] T5. `tests/unit/api/images/list-route.test.ts` に `vi.mock('@/src/lib/supabase/anon')` を追加
- [ ] T6. GET 系テストの `createClient.mockResolvedValue({})` を `createAnonClient.mockReturnValue({})` に置換
- [ ] T7. 「成功時は Cache-Control を返す」テストケースを追加

### 検証

- [ ] V1. `npm run lint` がパス
- [ ] V2. `npm run typecheck` がパス
- [ ] V3. `npm test` がパス
- [ ] V4. ローカル `npm run dev` で `GET /api/images` のレスポンスヘッダに `Cache-Control` が含まれることを Network で確認
- [ ] V5. ローカル `npm run dev` で `Set-Cookie` が GET レスポンスに乗らないことを確認
- [ ] V6. ローカルで `POST /api/images` (ログイン後) が 200/201 系で返ることを確認 (middleware の POST 通過確認)

### PR

- [ ] P1. 関心事ごとにコミット分割:
  - コミット 1: ステアリングファイル追加
  - コミット 2: 実装 (route.ts + middleware.ts)
  - コミット 3: テスト追加
- [ ] P2. PR タイトル: `/api/images GET に Cache-Control を付与し CDN キャッシュ対象化 (#46 案 #3)`
- [ ] P3. PR 本文: `Relates to #46`、設計概要 / 動作確認手順 / 計測予定を記載

## デプロイ後タスク (PR マージ前 preview で実施 / マージ後の追加確認)

### 計測

- [x] M1. Vercel preview URL で `/api/images` を 3 連続リクエストし `x-vercel-cache: HIT` を確認 (PR #149 description 参照)
- [ ] M2. Supabase Studio で 2 回目アクセスに SELECT が出ないことをログから確認 (ユーザ作業)
- [x] M3. Chrome DevTools MCP で `/` の TTFB / LCP を計測 (Preview vs Production を Before/After 相当として比較)

### 環境確認 (案 #4)

- [ ] R1. Supabase ダッシュボードでプロジェクトリージョンを確認 (期待: `ap-northeast-1`)
- [x] R2. Vercel 関数リージョンを `x-vercel-id` から確認 → Edge `hnd1` / Function `iad1` (US East)。**リージョンずれ確認**
- [ ] R3. `vercel.json` で `functions.regions: ['hnd1']` 指定 + Supabase リージョン確認は別 Issue 起票

### Issue クローズ

- [ ] C1. Issue #46 に計測結果 + リージョン確認結果をコメント
- [ ] C2. Issue #46 をクローズ

## 申し送り (振り返り)

### 実装完了日

2026-05-28 (PR #149 起票・preview 計測完了)

### 計測結果 (Production = #1+#2 / Preview = #1+#2+#3)

#### `/api/images` ヘッダ

| 試行 | Preview `x-vercel-cache` | Production `x-vercel-cache` |
|------|--------------------------|------------------------------|
| 1st  | MISS | MISS |
| 2nd  | **HIT** | MISS |
| 3rd  | **HIT** | MISS |

Preview の `set-cookie` なし、`x-vercel-id` は `hnd1::iad1::...` (Edge=東京 / Function=US East)。

#### `/api/images` TTFB (curl `time_starttransfer`)

| 試行 | Preview | Production | 差分 |
|------|---------|------------|------|
| 1st  | 0.445 s | 3.186 s | **-2.741 s** |
| 2nd  | 0.502 s | 1.065 s | -0.563 s |
| 3rd  | 0.316 s | 1.057 s | -0.741 s |

#### `/` Core Web Vitals (Chrome DevTools MCP, reload trace)

| 指標 | Preview | Production |
|------|---------|------------|
| LCP  | 284 ms | 510 ms |
| TTFB (LCP breakdown) | 9 ms | 11 ms |
| CLS  | 0.00 | 0.00 |

トップページ HTML は両環境ともキャッシュ対象外 (`cache-control: private, no-cache, no-store, ...`)。LCP 差はデータ量・warm 度合いの影響と思われ、`#3` の直接効果は `/api/images` 経由 (LoadMore) でのみ顕在化する。

### リージョン確認結果

- Vercel Edge: `hnd1` (Tokyo) ✅
- Vercel Function: `iad1` (US East / Virginia) ⚠️ → 別 Issue で `vercel.json` に `functions.regions: ['hnd1']` を指定
- Supabase: 未確認 (ユーザ作業)

### 計画と実績の差分

- 当初は「マージ後の本番計測」を想定していたが、Vercel Protection Bypass トークンを使うことで preview で前倒し計測できた
- 関数リージョン `iad1` の発見は計画外。`x-vercel-id` を見るだけで判明したのは収穫
- `Cache-Control` ヘッダはブラウザ向けに `public, max-age=0, must-revalidate` に rewrite されることを実測で確認 (Vercel の仕様)。CDN HIT の判定は `x-vercel-cache` で行う必要がある

### 学んだこと

- Vercel CDN は `s-maxage` を消費した後、ブラウザ向けヘッダを `public, max-age=0, must-revalidate` に置き換える。ブラウザは毎回 Edge に問い合わせるが Edge レイヤでは HIT が立つため CDN の意味はある
- `x-vercel-id` の構造 `<edge>::<function>::<reqid>` でリージョン関係が一目で分かる
- Protection Bypass for Automation は `?x-vercel-protection-bypass=<token>&x-vercel-set-bypass-cookie=samesitenone` でブラウザベースの計測も可能

### 次回への改善提案

- リージョン揃え (案 #4) は別 Issue として起票し、`vercel.json` の `functions.regions` 設定を追加する
- 本番 (`lgtmhub.vercel.app`) の SSR 関数も `iad1` のため、リージョン揃えで `/` 自体の SSR TTFB も改善余地あり
- preview 計測は Protection Bypass トークン経由で自動化できるため、将来のパフォーマンス系 PR にも活用

### 計画と実績の差分

(実装後に追記)

### 学んだこと

(実装後に追記)

### 次回への改善提案

(実装後に追記)
