# ランダム API を anon クライアントにし、proxy の認証往復を省く (#381)

## 結論

`GET /api/images/random` は `createAnonClient()` で読み、proxy でも `GET /api/images` と同じく early-return させる。ログイン不要の公開読み取りであり、Cookie 連携クライアントと proxy の `getUser` はどちらも Supabase Auth への往復と Set-Cookie を足すだけで結果を変えないため。

## 設計

- **route**: `createClient()`（`cookies()` 依存）を `createAnonClient()` に置き換える。RLS の `"anyone can view active images"` で anon でも `status='active'` を読めるので、返る画像は変わらない
- **proxy**: early-return の判定を、公開 GET パスの集合 `PUBLIC_GET_PATHS = new Set(['/api/images', '/api/images/random'])` との一致に変える。matcher は変えない（`/api/images/:path*` の POST・DELETE・regenerate は引き続き session refresh を通す）
- **テスト**: route の単体テストのモックを anon クライアントに差し替える。proxy の単体テストを新設し、公開 GET 2 パスでは `getUser` を呼ばず、`POST /api/images` と `DELETE /api/images/[id]` では呼ぶことを確認する

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| matcher から `/api/images/random` を外す | Next.js の matcher は method を区別できず、`/api/images/:path*` の否定先読みで書くと可読性が落ちる。既存の early-return と判定箇所が分かれる |
| proxy の early-return を `GET /api/images/*` 全体に広げる | 将来 `[id]` に認証付き GET を足したとき session refresh が黙って抜ける。公開パスは明示列挙にする |
| route だけ anon にし proxy は据え置く | proxy の `getUser` 往復と Set-Cookie が残り、Issue の目的を半分しか満たさない |

## Non-goals

- ランダム抽出の RPC 化による DB 往復の削減（#379 で扱う）
- `listActiveIds` の `max_rows=1000` による切り詰め（#379）
- レートリミット（service_role 経由）の呼び出し方の変更
