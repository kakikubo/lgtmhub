# Sentry によるエラー監視と Slack 通知 (#175)

## 結論
`@sentry/nextjs` を本番（`NEXT_PUBLIC_VERCEL_ENV=production`）でだけ有効化し、エラー監視以外の機能（トレース・Replay・PII）は無効にする。
Slack 通知は Sentry Internal Integration の Alert Rule Action（署名付き Webhook）を `/api/sentry-webhook` で受け、検証・整形して Slack Incoming Webhook へ転送する。
公式 Slack 連携は有料プラン専用のため、無料の Developer プランと無料の Slack で成立する構成はこれしかない。

## 設計

### 捕捉（SDK）
- `src/lib/monitoring/sentry-options.ts` に `init` の共通オプションを置き、client / server の両方から使う
  - `dsn: NEXT_PUBLIC_SENTRY_DSN`、`enabled: NEXT_PUBLIC_VERCEL_ENV === 'production'`
  - `sendDefaultPii: false`、`tracesSampleRate: 0`、Replay は integrations に入れない
- `instrumentation.ts`（nodejs のみ init、`onRequestError = captureRequestError`）と `instrumentation-client.ts` を置く
- `app/global-error.tsx` と `app/(site)/error.tsx` で `captureException(error)` を呼ぶ。クライアントのエラー境界で止まった例外は SDK が拾わないため
- CSP の `connect-src` に DSN のオリジンを足す（Supabase URL と同じく `originOf` で導出）
- `next.config.ts` を `withSentryConfig` で包む。`SENTRY_AUTH_TOKEN` があるビルド（= Vercel Production）だけ source map をアップロードし、アップロード後に削除する
- 検証用の `/api/debug-sentry` は管理者（`requireAdmin`）だけが例外を発生させられる。DoD の「アクセス制限」を満たすため、検証後も残す

### 通知（Slack 中継）
```
Sentry Alert Rule（A new issue is created / env=production）
  → POST /api/sentry-webhook  (Sentry-Hook-Resource: event_alert, Sentry-Hook-Signature)
  → HMAC-SHA256(raw body, SENTRY_WEBHOOK_SECRET) を timingSafeEqual で検証。不一致は 401
  → zod で data.event（title / culprit / web_url / environment）を取り出し、Slack Block Kit に整形
  → SLACK_WEBHOOK_URL へ POST
```
- `event_alert` 以外のリソース（installation 等）は 200 で無視する。Sentry の再送を招かないため
- 初回のみ通知・連打防止は Sentry のアラート条件（new issue）に任せ、中継側では重複排除しない

### 環境変数
| 変数 | スコープ | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | Production | 送信先。client でも使うため `NEXT_PUBLIC_` |
| `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` | Production | source map アップロード |
| `SENTRY_WEBHOOK_SECRET` | Production | Internal Integration の Client Secret |
| `SLACK_WEBHOOK_URL` | Production | Incoming Webhook |

## 検討した代替案
| 案 | 却下理由 |
|---|---|
| Sentry 公式 Slack 連携 | Team プラン（$26/月）専用 |
| Alert Rule の旧 Webhooks プラグイン（署名なし） | 受信元を検証できず、URL を知る第三者が Slack に任意の投稿をできる |
| `issue.created` Webhook を直接購読 | 環境で絞れない。アラートルールなら environment=production を条件にできる |
| `tunnelRoute` で同一オリジン経由にする | 広告ブロッカー回避が主目的で、本件の要件外。CSP に DSN オリジンを 1 つ足すほうが変更が小さい |
| Preview でも DSN を設定し `environment` で区別 | 無料枠を Preview のエラーで消費する。Issue でスコープ外 |

## Non-goals
- トレース・Session Replay・ユーザー単位の追跡
- edge ランタイムの計装（edge で動くコードがない）
- 中継側での重複排除・`Sentry-Hook-Timestamp` によるリプレイ対策
- Sentry / Slack / Vercel 側の設定作業そのもの（手順は README に書く）
