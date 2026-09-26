# CSP と HSTS ヘッダーの追加 (#276)

## 結論

nonce を使わない静的な CSP を `next.config.ts` の `headers()` で `Content-Security-Policy-Report-Only` として配信し、HSTS は `max-age=63072000; includeSubDomains` を明示する。
nonce 方式は全ページを動的レンダリングにする必要があり、`cacheComponents` の静的シェルと `'use cache'` を捨てることになるため採用しない。
e2e で主要ページの CSP 違反イベントが 0 件であることを検証し、enforce への切り替えは別 PR で行う。

## 設計

ポリシー（dev は React の `eval`・Vercel Analytics のデバッグスクリプト・HMR の WebSocket を追加で許可する。ローカル e2e は dev サーバーで動くため、dev でもヘッダーを付ける）:

| ディレクティブ | 値 | 根拠 |
|---|---|---|
| `default-src` | `'self'` | |
| `script-src` | `'self' 'unsafe-inline'` | Next.js の RSC ペイロード用 inline script。nonce を使わないため必須 |
| `style-src` | `'self' 'unsafe-inline'` | `next/image` の `fill` などが style 属性を出力する |
| `img-src` | `'self' https://*.public.blob.vercel-storage.com https://avatars.githubusercontent.com` | `unoptimized` の画像はブラウザが Blob / GitHub アバターを直接読む。ユーザー入力 URL はサーバー側で取得するためブラウザには届かない |
| `connect-src` | `'self'` | クライアントの fetch はすべて同一オリジンの `/api/*`。Vercel Analytics も production では同一オリジン |
| `form-action` | `'self'` + Supabase オリジン + `https://github.com` | JS 無効時の Server Action は form POST → Supabase → GitHub のリダイレクトになり、Chrome は form-action をリダイレクト先にも適用する |
| `frame-ancestors` / `object-src` | `'none'` | `X-Frame-Options: DENY` と同等 |
| `base-uri` | `'self'` | |

- ポリシー文字列は `src/lib/security/security-headers.ts` の純粋関数で組み立て、Vitest で検証する
- Supabase オリジンはビルド時の `NEXT_PUBLIC_SUPABASE_URL` から取る（Preview と本番でプロジェクトが異なるため）
- 既存 4 ヘッダーは `vercel.json` に残す。CSP/HSTS を `next.config.ts` に置くのは、`vercel.json` はローカルの `next start` に適用されず e2e で検証できないため
- Zod v4 が JIT 判定のため初回 parse 時に `Function('')` を呼び eval 違反を出す（e2e で検出）。`'unsafe-eval'` は許可せず `z.config({ jitless: true })` で判定自体を止める
- `docs/architecture.md` の「HSTS は二重指定しない」「CSP は proxy ベースで検討（未着手）」を更新する

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| proxy.ts で nonce 付き CSP | nonce はリクエストごとに変わるため全ページが動的レンダリングになり、静的シェルと `'use cache'` が効かなくなる。proxy の matcher も全ページに広げる必要がある（#46 で絞った経緯あり） |
| `vercel.json` に CSP を追加 | ローカル・e2e で検証できない。環境ごとに Supabase オリジンを変えられない |
| いきなり enforce | Issue の方針どおり Report-Only で Preview/本番の実トラフィックを観測してから切り替える |
| `report-uri` で違反を収集 | 収集先（Sentry 等）が未導入。今回は e2e とブラウザコンソールで確認する |

## Non-goals

- enforce (`Content-Security-Policy`) への切り替え
- 違反レポートの収集基盤
- HSTS preload 登録
- 既存 4 ヘッダーの `next.config.ts` への移設
