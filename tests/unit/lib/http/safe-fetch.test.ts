import { lookup } from 'node:dns/promises';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '@/src/lib/errors';
import { isPrivateIp, safeFetch } from '@/src/lib/http/safe-fetch';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

// `lookup` は overload で戻り値型が変わるため、テストでは Mock として扱う
const mockedLookup = lookup as unknown as Mock;

interface BuildResponseInput {
  body?: Buffer | null;
  status?: number;
  contentType?: string | null;
  contentLength?: string | null;
  ok?: boolean;
}

function buildResponse({
  body = Buffer.from([0xff, 0xd8]),
  status = 200,
  contentType = 'image/jpeg',
  contentLength,
  ok = true,
}: BuildResponseInput = {}): Response {
  const headers = new Headers();
  if (contentType !== null) headers.set('content-type', contentType);
  if (contentLength !== null && contentLength !== undefined) {
    headers.set('content-length', contentLength);
  }
  if (body === null) {
    return new Response(null, { status, headers, statusText: ok ? 'OK' : 'Error' });
  }
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(body));
      controller.close();
    },
  });
  return new Response(stream, { status, headers, statusText: ok ? 'OK' : 'Error' });
}

beforeEach(() => {
  mockedLookup.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isPrivateIp', () => {
  it('プライベート IPv4 範囲を判定する', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('172.16.5.5')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('169.254.1.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });

  it('IPv6 の loopback / link-local / unique-local を弾く', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('safeFetch', () => {
  it('HTTPS 以外の URL を拒否する', async () => {
    await expect(safeFetch('http://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestError);
  });

  it('プライベート IP に解決される URL を拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '10.0.0.1', family: 4 }]);
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('使用できません');
  });

  it('Content-Type が許可リスト外なら拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildResponse({ contentType: 'application/pdf' })),
    );
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('JPEG');
  });

  it('Content-Length がサイズ上限を超える場合は拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildResponse({ contentLength: String(20 * 1024 * 1024) })),
    );
    await expect(
      safeFetch('https://example.com/img.jpg', { maxBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow('10MB');
  });

  it('実際に読み込んだバイト数が上限を超えると拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildResponse({ body: big })));
    await expect(
      safeFetch('https://example.com/img.jpg', { maxBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow('10MB');
  });

  it('正常時に buffer と contentType を返す', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildResponse({ body, contentType: 'image/png' })),
    );
    const result = await safeFetch('https://example.com/img.png');
    expect(result.contentType).toBe('image/png');
    expect(result.buffer.equals(body)).toBe(true);
  });

  it('ステータスコードが 4xx の場合は拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(buildResponse({ status: 404, ok: false })),
    );
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('画像を取得');
  });

  it('DNS 解決失敗時は BadRequestError', async () => {
    mockedLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('画像を取得');
  });

  it('redirect が発生すると fetch がエラーを投げ、BadRequestError に変換される', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Redirect not allowed')),
    );
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestError);
  });
});
