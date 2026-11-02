import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/sentry-webhook/route';

const SECRET = 'test-client-secret';
const SLACK_URL = 'https://hooks.slack.com/services/T000/B000/XXXX';

const fetchMock = vi.fn();

function alertPayload(overrides: { title?: string } = {}) {
  return {
    action: 'triggered',
    data: {
      event: {
        title: overrides.title ?? 'TypeError: x is not a function',
        culprit: 'app/api/images/route.ts in GET',
        web_url: 'https://kakikubo.sentry.io/issues/123/events/abc/',
        environment: 'production',
        // Slack 通知に使わないフィールドが含まれていても受け付ける
        tags: [['level', 'error']],
      },
      triggered_rule: 'New issue in production',
    },
    installation: { uuid: 'a8e5d37a-696c-4c54-adb5-b3f28d64c7de' },
  };
}

function sign(body: string, secret = SECRET) {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex');
}

function request(
  body: string,
  {
    signature = sign(body),
    resource = 'event_alert',
  }: { signature?: string; resource?: string } = {},
) {
  return new NextRequest('http://localhost/api/sentry-webhook', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'sentry-hook-signature': signature,
      'sentry-hook-resource': resource,
    },
  });
}

beforeEach(() => {
  vi.stubEnv('SENTRY_WEBHOOK_SECRET', SECRET);
  vi.stubEnv('SLACK_WEBHOOK_URL', SLACK_URL);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response('ok', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sentSlackMessage(): unknown {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  expect(url).toBe(SLACK_URL);
  return JSON.parse(String(init?.body));
}

describe('POST /api/sentry-webhook', () => {
  it('署名が正しい Issue Alert をエラー名・発生箇所・Sentry へのリンク付きで Slack に送る', async () => {
    const body = JSON.stringify(alertPayload());

    const res = await POST(request(body));

    expect(res.status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const message = JSON.stringify(sentSlackMessage());
    expect(message).toContain('TypeError: x is not a function');
    expect(message).toContain('app/api/images/route.ts in GET');
    expect(message).toContain('https://kakikubo.sentry.io/issues/123/events/abc/');
    expect(message).toContain('新規エラー (production)');
  });

  it('エラー名に含まれる < > & をエスケープしてリンク記法を壊さない', async () => {
    const body = JSON.stringify(alertPayload({ title: 'Error: <a> & <b>' }));

    await POST(request(body));

    expect(JSON.stringify(sentSlackMessage())).toContain('Error: &lt;a&gt; &amp; &lt;b&gt;');
  });

  it.each([
    ['署名ヘッダがない', ''],
    ['別の鍵で署名されている', 'wrong-secret'],
  ])('%s場合は 401 を返し Slack に送らない', async (_, secretOrEmpty) => {
    const body = JSON.stringify(alertPayload());
    const signature = secretOrEmpty ? sign(body, secretOrEmpty) : '';

    const res = await POST(request(body, { signature }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('署名後にボディが改ざんされていれば 401 を返す', async () => {
    const body = JSON.stringify(alertPayload());
    const tampered = JSON.stringify(alertPayload({ title: 'injected' }));

    const res = await POST(request(tampered, { signature: sign(body) }));

    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('event_alert 以外のリソースは 2xx で無視する', async () => {
    const body = JSON.stringify({ action: 'created', data: {} });

    const res = await POST(request(body, { resource: 'installation' }));

    expect(res.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('想定外のペイロードは 400 を返す', async () => {
    const body = JSON.stringify({ action: 'triggered', data: {} });

    const res = await POST(request(body));

    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Slack が失敗を返したら 502 を返す', async () => {
    fetchMock.mockResolvedValue(new Response('invalid_token', { status: 403 }));

    const res = await POST(request(JSON.stringify(alertPayload())));

    expect(res.status).toBe(502);
  });

  it('環境変数が未設定なら 503 を返す', async () => {
    vi.stubEnv('SLACK_WEBHOOK_URL', '');

    const res = await POST(request(JSON.stringify(alertPayload())));

    expect(res.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
