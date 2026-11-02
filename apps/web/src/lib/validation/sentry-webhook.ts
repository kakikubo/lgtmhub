// スキーマ生成より前に jitless を効かせる (Issue #276)。必ず先頭に置く。
import '@/src/lib/validation/zod-config';
import { z } from 'zod';

// Sentry Internal Integration の Issue Alert (Sentry-Hook-Resource: event_alert) のペイロード。
// Slack 通知に使うフィールドだけを取り出し、それ以外は無視する。
// https://docs.sentry.io/organization/integrations/integration-platform/webhooks/issue-alerts/
export const sentryEventAlertSchema = z.object({
  action: z.literal('triggered'),
  data: z.object({
    event: z.object({
      title: z.string(),
      culprit: z.string().nullish(),
      web_url: z.string().url(),
      environment: z.string().nullish(),
    }),
    triggered_rule: z.string(),
  }),
});

export type SentryEventAlert = z.infer<typeof sentryEventAlertSchema>;
