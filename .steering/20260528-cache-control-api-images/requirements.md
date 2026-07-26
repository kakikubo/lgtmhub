# 要求: `/api/images` GET に Cache-Control を付与し CDN キャッシュに乗せる

## 背景 / 関連 issue

- GitHub issue: [#46 トップページの体感速度改善: Supabase 問い合わせ削減とキャッシュ導入](https://github.com/kakikubo/lgtmhub/issues/46)
- 本ステアリングは issue #46 の **改善案 #3** に対応する (残タスク)

issue #46 の改善案 #1 (unstable_cache 化 / PR #51) と #2 (middleware matcher 縮小 / PR #79) は既にマージ済みで、トップページ初回 SSR の Supabase 往復削減は達成済み。

一方、`docs/architecture.md:245` に明記された

> 画像一覧 API: `Cache-Control: s-maxage=60, stale-while-revalidate=300`（60秒キャッシュ＋5分リバリデート）

の方針が `app/api/images/route.ts` の GET に未反映で、**`LoadMoreButton` 経由のクライアント取得** と **トップ以外の経路 (将来追加されうる別ページなど) からの API 利用** が Vercel CDN キャッシュに乗らないままになっている。

## 対応する PRD / docs

- [技術仕様書: キャッシュ戦略 (architecture.md)](../../docs/architecture.md)
- [機能設計書: 画像一覧画面 (functional-design.md)](../../docs/functional-design.md)
- 過去 steering: [20260506-cache-image-list-on-home](../20260506-cache-image-list-on-home/), [20260510-narrow-middleware-matcher](../20260510-narrow-middleware-matcher/)

## 今回の実装スコープ

`/api/images` GET レスポンスに `Cache-Control: s-maxage=60, stale-while-revalidate=300` を付与する。CDN キャッシュを実効化するため、Cookie 依存も同時に断つ。

### 含むもの

1. **GET ハンドラを `createAnonClient` に切替**
   - 一覧取得は anon RLS (`anyone can view active images`) で完結するため、Cookie 連携の `createClient()` は不要
   - レスポンスに `Set-Cookie` が乗らなくなり Vercel CDN がキャッシュ対象として扱う
2. **`middleware.ts` に GET ショートサーキット追加**
   - `request.method === 'GET' && pathname === '/api/images'` のとき `auth.getUser()` をスキップして `NextResponse.next()` を即返す
   - Next.js の `config.matcher` はメソッド分岐できないため、middleware 本体で early-return する
3. **GET 成功レスポンスに `Cache-Control` を付与**
   - `Cache-Control: s-maxage=60, stale-while-revalidate=300`
   - architecture.md の文言と完全一致させる
4. **ユニットテスト追加**
   - `tests/unit/api/images/list-route.test.ts` の成功ケースに Cache-Control ヘッダ assertion を追加

### 含まないもの (スコープ外)

- `/api/images/random` の middleware ショートサーキット (本体は no-store 設定済みで体感影響なし。別 Issue で検討)
- `architecture.md` の文言変更 (既に整合済みのため変更不要)
- 過去 steering (20260506 / 20260510) の Before/After 表埋め戻し (遡及計測不能のため、今回 steering の retrospective に統合計測値として記録)
- リージョン揃え (案 #4) — ダッシュボード確認の運用タスク、本 PR には含めない

## 受け入れ条件

### 機能要件

- [ ] `/api/images` GET レスポンスヘッダに `Cache-Control: s-maxage=60, stale-while-revalidate=300` が含まれる
- [ ] `/api/images` GET ハンドラが `createAnonClient` を使用し Cookie に依存しない
- [ ] `middleware.ts` で GET `/api/images` への `auth.getUser()` 呼び出しが発生しない
- [ ] POST `/api/images` / DELETE `/api/images/[id]` の middleware による session refresh は従来通り動作する
- [ ] 投稿成功 / 削除成功で `revalidateTag(HOME_IMAGES_CACHE_TAG)` が呼ばれる挙動は変更しない (CDN キャッシュは 60s で自然失効するが、Server Component 側のキャッシュは従来通り即時破棄される)

### 品質 / 検証

- [ ] `npm run lint` / `npm run typecheck` / `npm test` が全パス
- [ ] 既存 E2E (`tests/e2e/image-list.test.ts`) が引き続きパス
- [ ] 新規ユニットテストで Cache-Control ヘッダの値を assertion している
- [ ] Vercel preview デプロイで `/api/images` への 2 回目アクセスに `x-vercel-cache: HIT` が返る
- [ ] Supabase Studio で 2 回目アクセス時に `lgtm_images` SELECT が発生しないことを確認

## 完了条件 (issue #46 全体)

issue #46 本文の完了条件:

- [x] (案 #1 + #2 + #3) トップページ初回表示で Supabase 往復が削減されていることをログ/Trace で検証 → **本ステアリング完了時に証跡を取得**
- [x] (案 #3) `architecture.md` の方針と実装が整合する → **本ステアリング完了時に達成**

## 前提・制約

- Next.js のキャッシュ API: `unstable_cache` / `revalidateTag` は既に導入済み
- Vercel CDN は `Set-Cookie` 付きレスポンスをキャッシュしない仕様。本 PR の anon 化はこれを回避するための前提条件
- `s-maxage=60` で投稿/削除直後の LoadMore に最大 60 秒の遅延が出るが、cursor 無しトップ一覧は SSR 側で `revalidateTag` 即時破棄されるため、ユーザー体験への影響は軽微 (合意済み)
