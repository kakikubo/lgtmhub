import { type NextRequest, NextResponse } from 'next/server';
import { verifySentrySignature } from '@/src/lib/monitoring/sentry-webhook-signature';
import { buildSlackMessage, postSlackMessage } from '@/src/lib/monitoring/slack-notification';
import { sentryEventAlertSchema } from '@/src/lib/validation/sentry-webhook';

// Sentry の Issue Alert (署名付き Webhook) を Slack Incoming Webhook へ中継する (Issue #175)。
// 公式 Slack 連携は有料プラン専用のため自前で中継する。初回のみ通知する制御は Sentry のアラート条件に任せる
export async function POST(request: NextRequest) {
  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!secret || !slackWebhookUrl) {
    console.error('[POST /api/sentry-webhook] SENTRY_WEBHOOK_SECRET / SLACK_WEBHOOK_URL が未設定');
    return NextResponse.json({ error: 'not configured' }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySentrySignature(rawBody, request.headers.get('sentry-hook-signature'), secret)) {
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 });
  }

  // installation 等の他リソースも同じ URL に届く。エラーを返すと Sentry が失敗として扱うため 2xx で無視する
  if (request.headers.get('sentry-hook-resource') !== 'event_alert') {
    return new NextResponse(null, { status: 204 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const parsed = sentryEventAlertSchema.safeParse(json);
  if (!parsed.success) {
    console.error('[POST /api/sentry-webhook] unexpected payload', parsed.error.issues);
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  try {
    await postSlackMessage(slackWebhookUrl, buildSlackMessage(parsed.data));
  } catch (err) {
    console.error('[POST /api/sentry-webhook] Slack への送信に失敗', err);
    return NextResponse.json({ error: 'slack delivery failed' }, { status: 502 });
  }

  return new NextResponse(null, { status: 204 });
}
