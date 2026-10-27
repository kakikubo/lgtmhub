const IP_PATTERN = /^[0-9a-fA-F:.]+$/;

/**
 * Vercel が付与するクライアント IP を取り出す。
 * `x-real-ip` を優先し、無ければ `x-forwarded-for` の先頭を使う。
 * 空・異常値はバケットを共有する `unknown` に倒す。
 */
export function clientIp(headers: Headers): string {
  const realIp = headers.get('x-real-ip')?.trim() ?? '';
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '';
  const candidate = realIp.length > 0 ? realIp : forwarded;
  if (candidate.length > 0 && candidate.length <= 64 && IP_PATTERN.test(candidate)) {
    return candidate;
  }
  return 'unknown';
}
