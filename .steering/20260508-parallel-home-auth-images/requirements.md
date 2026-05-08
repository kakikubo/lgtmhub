# 要求定義: ホームページの auth/画像取得を並列化

## 関連 Issue

- https://github.com/kakikubo/lgtmhub/issues/64

## 背景

`components/home-content.tsx` の `HomeContent` Server Component で、以下を **直列** に実行している:

1. `supabase.auth.getUser()` — Cookie 依存のため毎リクエストで Supabase Auth へ 1 RTT
2. `getHomeImagesInitial()` — `unstable_cache` (60s) でキャッシュ済み

直列実行のため、TTFB が「auth + images」の合計時間に支配される(ボトルネックになる)。`getHomeImagesInitial()` がキャッシュヒットしても、auth 完了までブロックされる。

## 用語

- **TTFB** (Time To First Byte): ブラウザがリクエストを送ってからサーバから最初の 1 バイトを受け取るまでの時間。
- **律速 / ボトルネック**: 全体の速度を決定づける処理。直列の場合「最も遅い処理」ではなく「合計時間」が応答速度を決める。

## 解決方針

`Promise.all` で `auth.getUser()` と `getHomeImagesInitial()` を並列化する。ログイン状態は EmptyState の文言と「ログインして登録」ボタン表示にのみ使われており、画像取得とは独立している。

既存の類似パターンが `app/(site)/images/[id]/page.tsx:60` にあるため、同じ実装スタイル(`Promise.all` + 個別 `.catch`)に揃える。

## 完了条件

| 指標 | 改善前 | 目標 |
|---|---|---|
| TTFB (コールド時) | 要計測 | -50ms 以上短縮 |
| `auth.getUser()` の wall-clock | 並列化前は critical path 上 | 並列化により隠蔽 |
| LCP | 807ms (Issue 計測時) | 750ms 以下 (他 Issue と独立した寄与分) |

### 機能要件 (リグレッション防止)

- ログイン済みユーザーで「ログインして登録」ボタン非表示が維持される
- 未ログインで EmptyState 文言が「GitHub でログインすると、画像を登録できます。」になる
- ログイン済みで EmptyState 文言が「最初の LGTM 画像を登録してみましょう。」になる
- 画像取得失敗時に `LoadErrorState` が表示される(現状の graceful degrade を維持)

## スコープ外

- middleware の auth 削減 (Issue #46 で扱う)
- 詳細ページ (既に並列化済み) の変更
- Server Timing による分離計測の本実装(必要に応じてローカル検証で `console.time` を使う程度に留める)
