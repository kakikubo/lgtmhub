# 要求内容 (Issue #126)

## 背景

ランダム表示ボタンを押した後の LGTM 画像カードで、投稿者アバターがフォールバック (Unknown + デフォルトアバター) になってしまう。

これは Issue #120 (解決済み) の「もっと読み込む」ボタンと同じ構造的問題で、`GET /api/images/random` のレスポンスに投稿者プロフィールが含まれていないため、クライアントが `ImageGrid` に `profiles` Map を渡せていないことが原因。

参考: 投稿者プロフィール表示の構造 (`components/home-content.tsx`)
- SSR で `buildUserProfileService(supabase).findManyByIds([...uploaderIds])` を 1 回呼ぶ。
- 取得結果を `Map<string, UserProfile>` に変換し `ImageGrid` に `profiles` prop で渡す。
- profile が無いカードは Unknown + デフォルトアバターに degrade する。

参考: Issue #120 の修正パターン (commit `4d18fb0`)
- `GET /api/images` に `profiles` を同梱する (`listImagesResponseSchema` に追加)。
- 失敗時は `[]` へ graceful degrade。
- クライアントは `Map<string, UserProfile>` へ復元し、`ImageGrid` に渡す。

## 達成したいこと (受け入れ条件)

1. **ランダム表示ボタン押下後も投稿者アバターが正しく表示される**
   - `GET /api/images/random` が投稿者プロフィールを同梱する。
   - クライアント (`HomeImages`) がそれを Map に復元し、`ImageGrid` の `profiles` prop に渡す。
2. **既存挙動を破壊しない**
   - 「ランダム表示中は『もっと読み込む』を出さない」(Issue #109)。
   - 「リロードでランダム状態が解除され通常表示へ戻る」(Issue #109)。
3. **graceful degrade**
   - プロフィール取得が失敗してもページ全体を 500 にせず、`profiles=[]` に degrade。
   - 該当カードは Unknown + デフォルトアバターにフォールバック。
4. **テスト**
   - スキーマ (`randomImagesResponseSchema`) の追加プロパティを単体テストで検証。
   - `GET /api/images/random` route のユニットテストを追加 (Issue #120 で追加した `list-route.test.ts` と同じパターン)。

## スコープ外

- ランダム表示のロジック変更 (Issue #109 の Fisher-Yates / `limit=16` 等)。
- `ImageCard` / `ImageGrid` 自体の改修 (今回は `profiles` prop に Map を渡すだけ)。
- 「もっと読み込む」側の挙動 (Issue #120 で対応済み)。

## 関連

- Issue #126
- Issue #120 - 同パターンの既存修正
- Issue #109 - ランダム表示機能の追加
