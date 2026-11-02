import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Sentry Integration Platform の Webhook 署名 (Sentry-Hook-Signature) を検証する。
 *
 * 署名は送信されたボディのバイト列に対する HMAC-SHA256 (Client Secret 鍵) の hex。
 * JSON を parse して再シリアライズするとキー順や空白が変わり得るため、生のボディで計算する。
 */
export function verifySentrySignature(
  rawBody: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest();
  const actual = Buffer.from(signature, 'hex');
  // 長さが違うと timingSafeEqual が例外を投げる。hex でない文字は Buffer.from が捨てるので長さで弾ける
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
