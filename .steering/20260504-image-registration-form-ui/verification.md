# 動作確認手順: 画像登録フォーム UI

PR #(未採番) の動作確認手順をローカル環境向けにまとめたもの。
Vercel preview / Supabase preview project が整うまでは本書を参照する。
基本前提は `.steering/20260504-image-list-screen/verification.md` と同じ (Supabase Local + dev サーバ)。

## 前提

- devcontainer 環境または Docker / Colima で Supabase Local を起動できること
- `.env.local` に `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` / `NEXT_PUBLIC_SUPABASE_ANON_KEY=...` が設定されていること
- 画像合成は外部 URL からの画像取得 → Vercel Blob 保存が必須なため、本物の登録フローを試す場合は `BLOB_READ_WRITE_TOKEN` も設定する (詳細は手順 3-B を参照)

## 手順 1: ローカル起動

```bash
git switch feature/image-registration-form-ui

# Colima ユーザーは vector / logflare を除外する
npx supabase start -x vector,logflare
# Docker Desktop の場合は npm run db:start で OK

npm run db:reset
npm run db:types

npm run dev
```

→ `http://localhost:3000/` を開く

## 手順 2: 未ログイン挙動の確認 (最短)

セッションなしでもページは 500 にならず、フォーム自体に到達できないことを確認する。

1. ブラウザを「シークレット / プライベートモード」で `http://localhost:3000/` を開く
2. ヘッダーに「画像を登録する」リンクが**表示されない**こと
3. アドレスバーに `http://localhost:3000/images/new` を直接打つ
4. → `http://localhost:3000/?auth_error=login_required` にリダイレクトされ、トップ画面に「ログインして登録」ボタンが見えること

これで PR Test plan の「未ログインリダイレクト」「ヘッダーリンク非表示」が確認できる。

## 手順 3: ログイン後フローの確認

### 3-A. 軽量チェック (フォーム描画のみ)

GitHub OAuth が整っていない環境でも、Supabase に手で auth ユーザーを差し込めばフォームに到達できる。
ただし API (`POST /api/images`) を叩くには Supabase の有効セッション cookie が必要なため、フォーム送信は 401 になる。「フォームが描画されること」「クライアント側 zod 検証が動くこと」までを確認する。

軽量チェックは省略可。次節 3-B のフルフローで包括的に確認する方が早い。

### 3-B. フルフロー確認 (推奨・GitHub OAuth + Vercel Blob 必須)

```
.env.local に以下を設定:
  GITHUB_CLIENT_ID=...
  GITHUB_CLIENT_SECRET=...
  BLOB_READ_WRITE_TOKEN=<Vercel Dashboard で生成>
```

1. `http://localhost:3000/` で「GitHub でログイン」 → OAuth 完了でトップに戻る
2. ヘッダーの「画像を登録する」リンクをクリック → `/images/new` に遷移
3. 「画像 URL」欄に **HTTPS の有効な画像 URL** (例: `https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800`) を入力
4. 「登録する」ボタン押下 → 数秒で `/` にリダイレクトされ、登録した LGTM 文字付き画像が一覧の先頭に表示されること

### 3-C. エラーケースの目視確認

| 入力 / 状態 | 期待表示 |
|------------|---------|
| 空欄で「登録する」 | ブラウザ標準のフォームバリデーション (required) で送信されない |
| `http://example.com/cat.jpg` | 「HTTPS の URL を入力してください」(zod の事前検証) |
| `not-a-url` | 「画像 URL の形式が正しくありません」(zod の事前検証) |
| 同じ URL で 2 回目登録 | 409: 「同じ画像がすでに登録されています」 |
| 11 回目以降の登録 | 429: 「本日の登録上限(10枚)に達しました。明日再度お試しください」 |
| dev サーバ稼働中に DB を停止 (`npm run db:stop`) して送信 | 500: 「画像の登録に失敗しました。時間をおいて再度お試しください」 |

セッションを切るには `signOut` ボタン or cookie 削除。401: 「セッションが切れました。再度ログインしてからお試しください」 + 「トップへ戻る」リンクの確認に使える。

## 手順 4: HTTP レベルの軽量確認

```bash
# Cookie はブラウザ DevTools → Application → Cookies からコピー
curl -s -X POST http://localhost:3000/api/images \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <sb-...-auth-token=...>' \
  -d '{"imageUrl":"https://images.unsplash.com/photo-1574158622682-e40e69881006?w=800"}' | jq

# 未ログイン (Cookie なし)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/images \
  -H 'Content-Type: application/json' \
  -d '{"imageUrl":"https://example.com/cat.jpg"}'
# → 401
```

## 後始末

```bash
# 登録した画像を削除する場合 (任意)
docker exec -i supabase_db_lgtmhub psql -U postgres -d postgres <<'SQL'
delete from public.lgtm_images where uploader_id = '<自分の auth.users.id>';
SQL

# Supabase Local 停止
npm run db:stop
```

## 推奨確認範囲

最短セット (合計 5 分):

- 手順 1 (起動)
- 手順 2 (未ログインリダイレクト + ヘッダーリンク非表示)
- 手順 3-B 全体 (フォーム送信 → 登録 → 一覧反映)

これで PR Test plan の主要項目はカバーできる。エラーケース (3-C) は時間に余裕があれば実施する。

## PR Test plan との対応

| Test plan 項目 | カバーする手順 |
|----------------|---------------|
| 未ログインで `/images/new` にアクセスすると `/` へリダイレクトされる | 手順 2 |
| ヘッダーの「画像を登録する」リンクは未ログイン時に表示されない | 手順 2 |
| ログイン済みユーザーがフォームから画像 URL を送信し、一覧に登録できる | 手順 3-B |
| 入力エラー / 重複 / 上限超過 / セッション切れの各メッセージが表示される | 手順 3-C |

## トラブルシューティング

### `/images/new` が 404 になる

`/Users/kakikubo/ghq/github.com/kakikubo/lgtmhub/app/(site)/images/new/page.tsx` が存在することを確認。
`npm run dev` を再起動。

### 登録ボタン押下後にトップへ遷移するが画像が出ない

- `router.refresh()` のキャッシュ破棄が効いているか DevTools の Network タブで `GET /` のレスポンスが新規取得 (304 ではなく 200) になっているか確認
- `lgtm_images` の status が `active` になっているか Supabase Studio で確認

### Colima 環境で `supabase start` が失敗する

`.steering/20260504-image-list-screen/verification.md` の「トラブルシューティング: Colima 環境」を参照。
