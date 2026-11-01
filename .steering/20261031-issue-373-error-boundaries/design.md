# エラー境界と not-found 画面を追加する (#373)

## 結論

Header のプロフィール取得失敗は catch して未ログイン表示に倒し、`app/(site)/error.tsx`・`app/(site)/not-found.tsx`・`app/global-error.tsx` を足す。Header は `(site)/layout.tsx` にあり、同じセグメントの `error.tsx` では捕捉できない（Next.js の error.js は同階層の layout を包まない）。そのため Header 自身で degrade させないと全ページが落ちる。

## 設計

- Header: `findById` を `.catch` して `console.error` し `null` を返す。詳細ページ（`images/[id]/page.tsx`）の投稿者取得と同じ degrade 方式にそろえる
- `(site)/error.tsx`: Client Component。Next 16.2 以降の `retry()`（再取得して再描画）を「再試行」ボタンに割り当て、トップへのリンクも置く。`error` は `unknown` で受け、メッセージは表示しない（本番では汎用文言に置き換わるため）
- `(site)/not-found.tsx`: 日本語文言とトップへのリンク。`(site)/layout.tsx` の内側で描画されるのでヘッダーも出る
- `global-error.tsx`: ルートレイアウトの失敗時に代わりに描画される。`<html lang="ja"><body>` を自前で持ち、`globals.css` を import する。文言と `retry()` は `(site)/error.tsx` と共通の `components/error-fallback.tsx` を使う

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| Header を独自の ErrorBoundary で包む | Server Component の throw を捕まえるには Client の境界が要り、`error.tsx` と役割が重なる。catch 1 行で済む |
| Header の失敗時に「ログイン中だがプロフィール不明」の表示を出す | 表示名・アバターが無いログイン UI を新設することになる。Issue の対応案どおり未ログイン相当にする |
| `app/not-found.tsx`（ルート）に置く | ルートレイアウトには Header が無く、ヘッダー付きの 404 にならない |

## Non-goals

- どのルートにも一致しない URL（例: `/foo`）の 404。ルートの `not-found.tsx` / `global-not-found.js` 側の話で、Header を出すには構成変更が要る
- エラー監視（Sentry 等）への送信
