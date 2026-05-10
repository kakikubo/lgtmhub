# 設計: middleware の matcher を保護ルートのみに絞る

## 方針

middleware の `config.matcher` を **除外型 (negative lookahead)** から **包含型 (allow list)** に切り替える。

理由:
- 「ログイン不要で見れる経路から auth.getUser() を消す」という意図が、コードを読んだだけで明確になる
- 新規追加経路は「自分は保護対象か」を意識して matcher に追記する運用になる
- 除外型で `/` や `/images/[id]` を `(?!...)` の negative lookahead に追記すると、可読性が著しく落ちる

## 変更内容

### `middleware.ts`

`config.matcher` を以下に置き換える:

```typescript
export const config = {
  matcher: [
    '/images/new',
    '/api/images',
    '/api/images/:path*',
  ],
};
```

#### 採用ルートの根拠

| ルート | HTTP メソッド | 認証要否 | matcher に含める理由 |
|--------|---------------|----------|----------------------|
| `/images/new` | GET | 必須 (Server Component で `redirect`) | session が古いと未ログイン扱いになり登録ページに到達できない |
| `/api/images` | POST | 必須 (`auth.getUser()` で 401) | 投稿時の session refresh |
| `/api/images/:path*` | DELETE | 必須 (`/api/images/[id]`) | 削除時の session refresh |

#### 含めないルートの根拠

| ルート | 理由 |
|--------|------|
| `/` (HomePage) | ログイン不要。`HomeContent` 内の `auth.getUser()` は「ログインボタンを出すかどうか」用途で、session 更新失敗で UI が「未ログイン表示」になっても致命傷ではない |
| `/images/[id]` | ログイン不要。`isOwner` 判定用途で、誤って `false` になっても表示自体は壊れない |
| `/api/auth/callback` | 自前で `response.cookies.set` を実行する設計のため、middleware の cookie 同期は不要 |
| `/api/auth/test-signin` | E2E 専用。同上 |
| `/api/images` GET | 認証不要。matcher に含めると将来 `Cache-Control` を付けた際に middleware 通過分の overhead が残る (改善案 #3 と整合) |

### 副作用と許容するトレードオフ

#### トレードオフ 1: トップページでの session 更新が走らない

ログイン中ユーザーが `/` を開いた際、middleware が走らないため access token が期限切れだと「ログアウト状態」として表示される。

許容する理由:
- 期限切れになるのは access token のみ。refresh token は cookie に残るため、`/images/new` などに遷移すれば middleware が走り再ログイン状態になる
- そもそも HomePage の `HomeContent` は `Server Component` で動くので、middleware なしで `auth.getUser()` を呼んでも session refresh の cookie 書き込みは `try/catch` で握り潰される (`src/lib/supabase/server.ts:21`)。Server Component 単体では session refresh は元から完結しない
- 実害は「ログイン中ユーザーがトップページで一瞬 "GitHub でログイン" ボタンを見る可能性」のみ

#### トレードオフ 2: GET /api/images にも matcher を効かせていない

`LoadMoreButton` 経由の追加読み込みで session refresh が走らなくなる。
- 追加読み込みは認証不要 (RLS で `anyone can view active images`)
- middleware は読み込みの本流ではない (`/images/new` などに遷移すれば走る)

## 実装ステップ

1. `middleware.ts` の `config.matcher` を上記の包含型に書き換える
2. `dev` で動作確認:
   - `/` を開いて Supabase Auth 関連の RTT が消えることを確認 (Network)
   - `/images/new` 未ログイン時の redirect が動くことを確認
   - ログイン後 `/images/new` 表示・登録が動くことを確認
   - ログイン後 `/api/images` POST が 200 系で返ることを確認
3. `npm test` / `npm run lint` / `npm run typecheck` を実行
4. E2E (`npm run test:e2e`) を実行 → 既存導線が壊れていないことを確認

## 影響範囲

- `middleware.ts` のみ
- 既存の Server Component / Route Handler / Server Action コードには触らない
- E2E テストは既存のものを流用 (新規テストは追加しない)

## docs 更新

`docs/architecture.md` に matcher 設計を反映するかは振り返りで判断する。現状 `architecture.md:240` 周辺に middleware の挙動に関する明示記述はないため、今回は **追記しない** 方針で着手する。
