# 要求: トップページ画像一覧の Supabase 問い合わせをキャッシュ化

## 背景 / 関連 issue

- GitHub issue: [#46 トップページの体感速度改善: Supabase 問い合わせ削減とキャッシュ導入](https://github.com/kakikubo/lgtmhub/issues/46)
- 本ステアリングは issue #46 の **改善案 #1** に対応する

`https://lgtmhub.vercel.app/` のトップページ表示が想定より遅い。原因調査の結果、トップページが完全な動的 SSR となっており、**1 リクエストごとに Supabase へ最低 3 回の往復**が発生していることが判明した。

| 問い合わせ箇所 | 種類 | 備考 |
|---|---|---|
| `middleware.ts:25` | `auth.getUser()` | 全 HTML リクエスト |
| `app/(site)/page.tsx:40` | `auth.getUser()` | リクエストごと |
| `app/(site)/page.tsx:48` | `imageRepo.list()` | リクエストごと |

トップページは未ログイン閲覧者がほとんどで、画像一覧の更新頻度はそれほど高くない (1 日数件〜十数件程度の投稿想定)。**画像一覧取得は明らかにキャッシュに乗せてよい性質のデータ**にもかかわらず、現状毎回 DB を叩いている。

`docs/architecture.md:244` には「画像一覧 API: `Cache-Control: s-maxage=60, stale-while-revalidate=300`」と方針が書かれているが、実装には反映されていない。

## 対応する PRD / docs

- [PRD 受け入れ条件: パフォーマンス](../../docs/product-requirements.md) — LCP 3 秒以内、画像表示 2 秒以内
- [機能設計書: 画像一覧画面](../../docs/functional-design.md)
- [技術仕様書: パフォーマンス / キャッシュ戦略](../../docs/architecture.md)

## 今回の実装スコープ

トップページの **画像一覧取得 (`imageRepo.list()` 経路)** を Next.js の `unstable_cache` でタグ付きキャッシュ化し、投稿/削除時に `revalidateTag` で破棄する。

- `imageRepo.list()` を直接呼ぶ Server Component (`app/(site)/page.tsx`) のデータ取得部分をキャッシュ層でラップする
- 投稿成功 (`POST /api/images`) と削除成功 (`DELETE /api/images/[id]`) のタイミングで `revalidateTag('lgtm-images:list')` を呼び、キャッシュを無効化する
- `auth.getUser()` (= ログインユーザー判定) は **キャッシュ対象外** (Cookie 依存・ユーザー単位のため)。本ステアリングのスコープ外

## 受け入れ条件

### 機能要件

- [ ] トップページ初回ロード時、画像一覧の取得は最大 1 回 DB に問い合わせ、以降同じ条件 (cursor 無し / デフォルト limit) のリクエストはキャッシュから返ること
- [ ] 投稿成功 (`POST /api/images` が 201 を返す) 直後にトップページを再読み込みすると、新規投稿が一覧に反映されていること
- [ ] 削除成功 (`DELETE /api/images/[id]` が 204 を返す) 直後にトップページを再読み込みすると、削除画像が一覧から消えていること
- [ ] キャッシュタグは `'lgtm-images:list'` を採用 (将来の追加キャッシュとの衝突回避用に名前空間を切る)
- [ ] LoadMoreButton 経由のページ送り (cursor 付き) は本対応のスコープ外。今回はトップページの初期一覧 (cursor 無し / デフォルト limit) のみキャッシュ対象とする

### 品質 / 検証

- [ ] `npm run lint` / `npm run typecheck` / `npm test` がエラーなく通る
- [ ] 既存 E2E (`tests/e2e/image-list.test.ts`) が引き続き通る
- [ ] 投稿 → トップページ再読み込みで反映、削除 → トップページ再読み込みで反映、の手動シナリオを実機 (ローカル `npm run start` または Vercel preview) で確認できる
- [ ] Supabase 側のリクエストログまたは Vercel Function ログで「2 回目以降の同条件アクセスでは `lgtm_images` への SELECT が発生しない」ことを確認できる
- [ ] 計測: ステアリング着手時に Chrome DevTools MCP で TTFB / LCP のビフォー値を取得し、実装後にアフター値と比較する

## 今回スコープ外 (意図的に除外)

- `middleware.ts` の matcher 縮小 (issue #46 案 #2 — 別ステアリングで対応)
- `/api/images` の `Cache-Control` 付与 (issue #46 案 #3 — 別ステアリングで対応)
- Supabase / Vercel 関数のリージョン揃え (issue #46 案 #4 — 環境設定の確認のみ)
- `auth.getUser()` のキャッシュ化 (Cookie 依存のため不可)
- LoadMoreButton 経由の cursor 付きページの一覧キャッシュ (キー設計が複雑になり費用対効果が低い)
- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) のキャッシュ化

## 前提・制約

- Next.js のキャッシュ API: 現状の依存している Next.js のバージョンで利用できる API を使う (`unstable_cache` / `revalidateTag` を想定。`use cache` ディレクティブを使うかどうかは設計フェーズで検討)
- キャッシュ TTL: アプリ層で 60 秒程度を想定 (新規投稿時は `revalidateTag` で即時無効化されるため、TTL は「タグ破棄が漏れた場合の最大不整合時間」として機能)
- 認証必須操作 (POST / DELETE) のレスポンスでキャッシュ破棄を行うため、未認証経路でキャッシュが汚染されることはない
- Supabase Realtime や外部 admin 操作で直接 DB が書き換わるケースは現状想定しない (キャッシュ破棄経路はアプリ内のミューテーションのみで十分)
