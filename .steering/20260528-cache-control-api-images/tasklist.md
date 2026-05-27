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

## デプロイ後タスク (PR マージ後)

### 計測

- [ ] M1. Vercel preview URL で `curl -I /api/images` を 2 回叩き `x-vercel-cache: HIT` を確認
- [ ] M2. Supabase Studio で 2 回目アクセスに SELECT が出ないことをログから確認
- [ ] M3. Chrome DevTools MCP で `/` の TTFB / LCP を計測 (Before = 直前本番、After = デプロイ後)

### 環境確認 (案 #4)

- [ ] R1. Supabase ダッシュボードでプロジェクトリージョンを確認 (期待: `ap-northeast-1`)
- [ ] R2. Vercel ダッシュボードで関数リージョンを確認 (期待: `hnd1`)
- [ ] R3. ずれていれば別 Issue 起票 (本 Issue ではクローズ条件外)

### Issue クローズ

- [ ] C1. Issue #46 に計測結果 + リージョン確認結果をコメント
- [ ] C2. Issue #46 をクローズ

## 申し送り (振り返り)

### 実装完了日

(未着手)

### 計測結果 (Before → After)

| 指標 | Before (#3 未適用) | After (#3 適用後) | 改善幅 |
|------|-------------------|------------------|--------|
| `/api/images` `x-vercel-cache` | MISS (or BYPASS) | HIT (2 回目) |  |
| `/` TTFB (preview) |  |  |  |
| `/` LCP (preview) |  |  |  |
| `/api/images` 2 回目アクセス時の Supabase SELECT |  |  |  |

### リージョン確認結果

- Supabase: (未確認)
- Vercel: (未確認)
- 揃っているか: (未確認)

### 計画と実績の差分

(実装後に追記)

### 学んだこと

(実装後に追記)

### 次回への改善提案

(実装後に追記)
