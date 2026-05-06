# タスクリスト: トップページ画像一覧の Supabase 問い合わせをキャッシュ化

## 事前計測タスク

- [ ] M1. PR 化前に Chrome DevTools MCP で本番環境の TTFB / LCP を計測し Before 値を記録 (実装は本番未反映のため後撮りで問題なし)

## 実装タスク

- [x] T1. `src/lib/cache/list-home-images.ts` を新規作成
- [x] T2. `app/(site)/page.tsx` の取得呼び出しを `getHomeImagesInitial()` に置き換え
- [x] T3. `app/api/images/route.ts` (POST) に `revalidateTag(HOME_IMAGES_CACHE_TAG)` を追加
- [x] T4. `app/api/images/[id]/route.ts` (DELETE) に `revalidateTag(HOME_IMAGES_CACHE_TAG)` を追加

## リスク対応タスク

- [x] R1. **発生** : ローカル `npm run build && npm run start` で `Route / used "cookies" inside a function cached with "unstable_cache(...)"` エラーが発生 → 対応として `src/lib/supabase/anon.ts` を新設し、`getHomeImagesInitial` 内で Cookie 非依存の `createAnonClient()` を使うよう差し替え。RLS の `"anyone can view active images"` (`status='active'` で anon SELECT 可) で安全性確認済み

## 検証タスク

- [x] V1. `./node_modules/.bin/biome lint .` 実行: `Checked 73 files. No fixes applied.` (pass)
- [x] V2. `./node_modules/.bin/tsc --noEmit` 実行: エラーなし (pass)
- [x] V3. `./node_modules/.bin/vitest run` 実行: **150 / 150 pass** (`delete-route.test.ts` に `next/cache` モックと revalidateTag アサーション追加)
- [ ] V4. 既存 E2E `tests/e2e/image-list.test.ts` の通過確認 (ローカル Supabase 必須のため CI 上で確認予定)
- [x] V5. ローカル production 起動でトップページに 3 回連続アクセス → サーバログ `[cache-miss]` は **1 回のみ** 出力。2 回目以降はキャッシュヒット (応答時間 6.4ms → 5.0ms → 5.0ms)
- [ ] V6. ログイン → 画像投稿 → 一覧に反映 (Vercel preview で確認予定)
- [ ] V7. ログイン → 画像削除 → 一覧から消える (Vercel preview で確認予定)
- [ ] V8. Vercel preview 上で TTFB / LCP を再計測し Before と比較
- [ ] V9. implementation-validator サブエージェントによる実装レビュー

## ドキュメント / クローズアウト

- [ ] D1. PR 本文に「issue #46 案 #1 のみ完了。案 #2/#3/#4 は別 PR」を明記
- [ ] D2. (任意) `docs/architecture.md` のキャッシュ戦略節に「トップページ画像一覧は `unstable_cache(tag='lgtm-images:list', revalidate=60)` で包む」と追記

## 申し送り (振り返り)

### 実装完了日

(未着手)

### 計測結果 (Before → After)

| 指標 | Before | After | 改善幅 |
|------|--------|-------|--------|
| TTFB |  |  |  |
| LCP |  |  |  |
| Supabase 往復 (同条件 2 回目) |  |  |  |

### 計画と実績の差分

(実装後に追記)

### 学んだこと

(実装後に追記)

### 次回への改善提案

(実装後に追記)
