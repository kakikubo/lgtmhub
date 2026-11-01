import { lookup as lookupCallback } from 'node:dns';
import { lookup } from 'node:dns/promises';
import { fetch } from 'undici';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '@/src/lib/errors';
import { guardedLookup, isPrivateIp, safeFetch } from '@/src/lib/http/safe-fetch';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

vi.mock('node:dns', () => ({
  lookup: vi.fn(),
}));

vi.mock('undici', () => ({
  Agent: vi.fn(),
  fetch: vi.fn(),
}));

// `lookup` は overload で戻り値型が変わるため、テストでは Mock として扱う
const mockedLookup = lookup as unknown as Mock;
const mockedLookupCallback = lookupCallback as unknown as Mock;
// undici の Response 型は lib.dom の Response と別物のため、テストでは Mock として扱う
const mockedFetch = fetch as unknown as Mock;

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
  mockedLookupCallback.mockReset();
  mockedFetch.mockReset();
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

  it.each([
    ['0.0.0.0'],
    ['100.64.0.1'],
    ['100.127.255.254'],
    ['192.0.0.1'],
    ['192.0.2.1'],
    ['198.18.0.1'],
    ['198.19.255.254'],
    ['198.51.100.1'],
    ['203.0.113.1'],
    ['224.0.0.1'],
    ['240.0.0.1'],
    ['255.255.255.255'],
    ['::'],
    ['::ffff:127.0.0.1'],
    ['::ffff:10.0.0.1'],
    ['64:ff9b::7f00:1'],
    ['2002:7f00:1::'],
    ['2001::1'],
    ['2001:db8::1'],
    ['ff02::1'],
    ['fd00::1'],
  ])('公開ユニキャスト以外の %s を拒否する', (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  it.each([['8.8.8.8'], ['1.1.1.1'], ['100.128.0.1'], ['2606:4700::1111'], ['2404:6800::1']])(
    '公開ユニキャストの %s は許可する',
    (ip) => {
      expect(isPrivateIp(ip)).toBe(false);
    },
  );

  it('IP アドレスとしてパースできない値は拒否する', () => {
    expect(isPrivateIp('example.com')).toBe(true);
    expect(isPrivateIp('')).toBe(true);
    expect(isPrivateIp('999.1.1.1')).toBe(true);
  });
});

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  addresses: { address: string; family: number }[],
) => void;

function stubResolve(addresses: { address: string; family: number }[]) {
  mockedLookupCallback.mockImplementation((_host: string, _opts: unknown, cb: LookupCallback) => {
    cb(null, addresses);
  });
}

function runGuardedLookup(all: boolean) {
  return new Promise<{ err: Error | null; address: unknown; family: unknown }>((resolve) => {
    guardedLookup('example.com', { all }, (err, address, family) => {
      resolve({ err, address, family });
    });
  });
}

describe('guardedLookup', () => {
  it('公開 IP だけなら all: true で解決結果をそのまま返す', async () => {
    const addresses = [
      { address: '8.8.8.8', family: 4 },
      { address: '2606:4700::1111', family: 6 },
    ];
    stubResolve(addresses);
    const result = await runGuardedLookup(true);
    expect(result.err).toBeNull();
    expect(result.address).toEqual(addresses);
    expect(mockedLookupCallback).toHaveBeenCalledWith(
      'example.com',
      expect.objectContaining({ all: true }),
      expect.any(Function),
    );
  });

  it('公開 IP だけなら all: false で先頭のアドレスを返す', async () => {
    stubResolve([
      { address: '8.8.8.8', family: 4 },
      { address: '1.1.1.1', family: 4 },
    ]);
    const result = await runGuardedLookup(false);
    expect(result.err).toBeNull();
    expect(result.address).toBe('8.8.8.8');
    expect(result.family).toBe(4);
  });

  it.each([[true], [false]])('内部 IP が 1 つでも混ざると拒否する (all: %s)', async (all) => {
    stubResolve([
      { address: '8.8.8.8', family: 4 },
      { address: '169.254.169.254', family: 4 },
    ]);
    const result = await runGuardedLookup(all);
    expect(result.err).toBeInstanceOf(BadRequestError);
  });

  it('解決結果が空なら拒否する', async () => {
    stubResolve([]);
    const result = await runGuardedLookup(true);
    expect(result.err).toBeInstanceOf(BadRequestError);
  });

  it('DNS エラーはそのまま伝える', async () => {
    const dnsError = new Error('ENOTFOUND');
    mockedLookupCallback.mockImplementation((_host: string, _opts: unknown, cb: LookupCallback) => {
      cb(dnsError, []);
    });
    const result = await runGuardedLookup(true);
    expect(result.err).toBe(dnsError);
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
    mockedFetch.mockResolvedValue(buildResponse({ contentType: 'application/pdf' }));
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('JPEG');
  });

  it('Content-Length がサイズ上限を超える場合は拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mockedFetch.mockResolvedValue(buildResponse({ contentLength: String(20 * 1024 * 1024) }));
    await expect(
      safeFetch('https://example.com/img.jpg', { maxBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow('10MB');
  });

  it('実際に読み込んだバイト数が上限を超えると拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const big = Buffer.alloc(11 * 1024 * 1024, 0);
    mockedFetch.mockResolvedValue(buildResponse({ body: big }));
    await expect(
      safeFetch('https://example.com/img.jpg', { maxBytes: 10 * 1024 * 1024 }),
    ).rejects.toThrow('10MB');
  });

  it('正常時に buffer と contentType を返す', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    const body = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    mockedFetch.mockResolvedValue(buildResponse({ body, contentType: 'image/png' }));
    const result = await safeFetch('https://example.com/img.png');
    expect(result.contentType).toBe('image/png');
    expect(result.buffer.equals(body)).toBe(true);
  });

  it('接続先を検証する dispatcher を付け、リダイレクトを禁止して取得する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mockedFetch.mockResolvedValue(buildResponse());
    await safeFetch('https://example.com/img.jpg');
    expect(mockedFetch).toHaveBeenCalledWith(
      'https://example.com/img.jpg',
      expect.objectContaining({ redirect: 'error', dispatcher: expect.any(Object) }),
    );
  });

  it('IP リテラルの URL も公開ユニキャスト以外は拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '100.64.0.1', family: 4 }]);
    await expect(safeFetch('https://100.64.0.1/img.jpg')).rejects.toThrow('使用できません');
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('IPv6 リテラルの URL は角括弧を外して名前解決する', async () => {
    mockedLookup.mockResolvedValue([{ address: '64:ff9b::7f00:1', family: 6 }]);
    await expect(safeFetch('https://[64:ff9b::7f00:1]/img.jpg')).rejects.toThrow('使用できません');
    expect(mockedLookup).toHaveBeenCalledWith('64:ff9b::7f00:1', { all: true });
  });

  it('接続時の名前解決で拒否された場合は BadRequestError に変換される', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mockedFetch.mockRejectedValue(
      new TypeError('fetch failed', { cause: new BadRequestError('このURLは使用できません') }),
    );
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('画像を取得');
  });

  it('ステータスコードが 4xx の場合は拒否する', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mockedFetch.mockResolvedValue(buildResponse({ status: 404, ok: false }));
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('画像を取得');
  });

  it('DNS 解決失敗時は BadRequestError', async () => {
    mockedLookup.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toThrow('画像を取得');
  });

  it('redirect が発生すると fetch がエラーを投げ、BadRequestError に変換される', async () => {
    mockedLookup.mockResolvedValue([{ address: '8.8.8.8', family: 4 }]);
    mockedFetch.mockRejectedValue(new TypeError('Redirect not allowed'));
    await expect(safeFetch('https://example.com/img.jpg')).rejects.toBeInstanceOf(BadRequestError);
  });
});
