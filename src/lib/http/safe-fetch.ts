import { lookup as dnsLookup } from 'node:dns/promises';
import net from 'node:net';
import { BadRequestError } from '@/src/lib/errors';

const PRIVATE_IPV4_RANGES: RegExp[] = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^0\./,
];

const PRIVATE_IPV6_PREFIXES: string[] = ['::1', 'fc', 'fd', 'fe80', '::ffff:'];

export const DEFAULT_MAX_FETCH_BYTES = 10 * 1024 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
export const DEFAULT_ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  allowedContentTypes?: readonly string[];
}

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string;
}

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    return PRIVATE_IPV4_RANGES.some((re) => re.test(ip));
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    return PRIVATE_IPV6_PREFIXES.some((prefix) => lower.startsWith(prefix));
  }
  return false;
}

function normalizeContentType(raw: string | null): string {
  if (!raw) return '';
  const semi = raw.indexOf(';');
  return (semi === -1 ? raw : raw.slice(0, semi)).trim().toLowerCase();
}

export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_FETCH_BYTES;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const allowedContentTypes = options.allowedContentTypes ?? DEFAULT_ALLOWED_CONTENT_TYPES;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new BadRequestError('画像 URL の形式が正しくありません');
  }
  if (parsed.protocol !== 'https:') {
    throw new BadRequestError('HTTPS の URL を入力してください');
  }

  // DNS チェックと fetch の間で DNS エントリが書き換わる DNS rebinding は
  // アプリレイヤーで完全には防げない。Vercel Functions の実行環境では同一リクエスト内に
  // 該当攻撃を成立させる手段が現実的でないため、本実装ではここまでの緩和に留める。
  const lookups = await dnsLookup(parsed.hostname, { all: true }).catch(() => {
    throw new BadRequestError('画像を取得できませんでした。URL を確認してください');
  });
  if (lookups.some(({ address }) => isPrivateIp(address))) {
    throw new BadRequestError('このURLは使用できません');
  }

  // redirect: 'error' で SSRF 経由のリダイレクトを封じる
  const response = await fetch(parsed.toString(), {
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
  }).catch((err: unknown) => {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new BadRequestError('画像の取得がタイムアウトしました');
    }
    throw new BadRequestError('画像を取得できませんでした。URL を確認してください');
  });

  if (!response.ok) {
    throw new BadRequestError('画像を取得できませんでした。URL を確認してください');
  }

  const contentType = normalizeContentType(response.headers.get('content-type'));
  if (!allowedContentTypes.includes(contentType)) {
    throw new BadRequestError('JPEG・PNG・GIF 形式の画像 URL を入力してください');
  }

  const declaredLength = Number(response.headers.get('content-length') ?? Number.NaN);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new BadRequestError('10MB 以下の画像を使用してください');
  }

  if (!response.body) {
    throw new BadRequestError('画像を取得できませんでした。URL を確認してください');
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new BadRequestError('10MB 以下の画像を使用してください');
      }
      chunks.push(value);
    }
  }

  return {
    buffer: Buffer.concat(chunks, received),
    contentType,
  };
}
