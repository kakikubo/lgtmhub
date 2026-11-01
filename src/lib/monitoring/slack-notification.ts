import type { SentryEventAlert } from '@/src/lib/validation/sentry-webhook';

const SLACK_TIMEOUT_MS = 5_000;

export class SlackNotificationError extends Error {
  constructor(status: number) {
    super(`Slack Incoming Webhook が ${status} を返しました`);
    this.name = 'SlackNotificationError';
  }
}

// Slack の mrkdwn で制御文字として解釈される 3 文字だけをエスケープする
// https://api.slack.com/reference/surfaces/formatting#escaping
function escapeMrkdwn(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

/** Issue Alert を Slack の Block Kit メッセージに整形する。エラー名・発生箇所・Sentry へのリンクを含める */
export function buildSlackMessage({ data }: SentryEventAlert) {
  const { title, culprit, web_url: webUrl, environment } = data.event;
  const heading = `:rotating_light: 新規エラー (${environment ?? 'unknown'})`;

  return {
    // 通知プレビューと blocks を表示できないクライアント用
    text: `${heading}: ${title}`,
    blocks: [
      { type: 'header', text: { type: 'plain_text', text: heading } },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            `*<${webUrl}|${escapeMrkdwn(title)}>*`,
            `発生箇所: \`${escapeMrkdwn(culprit || '不明')}\``,
          ].join('\n'),
        },
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `ルール: ${escapeMrkdwn(data.triggered_rule)}` }],
      },
    ],
  };
}

export async function postSlackMessage(webhookUrl: string, message: object): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
  });
  // 成功時のボディ ("ok") は使わないが、読まずに残すと接続が解放されないため破棄する
  await res.body?.cancel();
  if (!res.ok) throw new SlackNotificationError(res.status);
}
