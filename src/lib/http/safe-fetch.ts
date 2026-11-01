import { lookup as dnsLookupCallback } from 'node:dns';
import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupFunction } from 'node:net';
import ipaddr from 'ipaddr.js';
import { Agent, fetch } from 'undici';
import { BadRequestError } from '@/src/lib/errors';

export const DEFAULT_MAX_FETCH_BYTES = 10 * 1024 * 1024;
export const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
export const DEFAULT_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export interface SafeFetchOptions {
  maxBytes?: number;
  timeoutMs?: number;
  allowedContentTypes?: readonly string[];
}

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string;
}

// 公開ユニキャスト以外 (プライベート・ループバック・リンクローカル・CGNAT・マルチキャスト・
// 予約・IPv4 埋め込み IPv6 など) はすべて拒否する許可リスト方式。パースできない値も拒否する
export function isPrivateIp(ip: string): boolean {
  if (!ipaddr.isValid(ip)) return true;
  return ipaddr.parse(ip).range() !== 'unicast';
}

// 接続時の名前解決で使う lookup。解決結果を検証してから返すため、
// 事前チェックの後に DNS の応答が変わっても検証済みでない IP には接続しない
export const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookupCallback(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, '');
      return;
    }
    const [first] = addresses;
    if (!first || addresses.some(({ address }) => isPrivateIp(address))) {
      callback(new BadRequestError('このURLは使用できません'), '');
      return;
    }
    if (options.all) {
      callback(null, addresses);
      return;
    }
    callback(null, first.address, first.family);
  });
};

const pinnedAgent = new Agent({ connect: { lookup: guardedLookup } });

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

  // 利用者向けのエラーを出し分けるための事前チェック。IP リテラルの URL は接続時に
  // 名前解決されないため、ここで判定する。ホスト名の場合は接続時にも guardedLookup で再検証する
  // IPv6 リテラルの hostname は [::1] のように角括弧つきで返るため外してから解決する
  const hostname = parsed.hostname.replace(/^\[(.*)\]$/, '$1');
  const lookups = await dnsLookup(hostname, { all: true }).catch(() => {
    throw new BadRequestError('画像を取得できませんでした。URL を確認してください');
  });
  if (lookups.some(({ address }) => isPrivateIp(address))) {
    throw new BadRequestError('このURLは使用できません');
  }

  // redirect: 'error' で SSRF 経由のリダイレクトを封じる
  const response = await fetch(parsed.toString(), {
    redirect: 'error',
    signal: AbortSignal.timeout(timeoutMs),
    dispatcher: pinnedAgent,
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
    throw new BadRequestError('JPEG・PNG・GIF・WebP 形式の画像 URL を入力してください');
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
