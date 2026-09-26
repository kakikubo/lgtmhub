type BuildContentSecurityPolicyOptions = {
  /** OAuth の遷移先。ビルド時の NEXT_PUBLIC_SUPABASE_URL (Preview と本番で別プロジェクト) */
  supabaseUrl: string | undefined;
  isDev: boolean;
};

/**
 * 全ページ共通の Content-Security-Policy を組み立てる。
 *
 * nonce を使わない静的ポリシーにしている。nonce はリクエストごとに変わるため全ページが
 * 動的レンダリングになり、cacheComponents の静的シェルと 'use cache' が効かなくなる。
 * その代わり Next.js の RSC ペイロード用 inline script のため script-src に
 * 'unsafe-inline' を許可する (Issue #276)。
 */
export function buildContentSecurityPolicy({
  supabaseUrl,
  isDev,
}: BuildContentSecurityPolicyOptions): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    // dev は React が eval でスタックを復元し、Vercel Analytics がデバッグ版スクリプトを外部から読む
    'script-src': [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'", 'https://va.vercel-scripts.com'] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    // unoptimized の画像はブラウザが Blob / GitHub アバターを直接読む。
    // ユーザー入力の画像 URL はサーバー側で取得するためブラウザには届かない
    'img-src': [
      "'self'",
      'https://*.public.blob.vercel-storage.com',
      'https://avatars.githubusercontent.com',
    ],
    'font-src': ["'self'"],
    // クライアントの fetch はすべて同一オリジンの /api/*。dev は HMR の WebSocket を足す
    'connect-src': ["'self'", ...(isDev ? ['ws:'] : [])],
    // JS 無効時の Server Action は form POST → Supabase → GitHub とリダイレクトし、
    // Chrome は form-action をリダイレクト先にも適用する
    'form-action': ["'self'", ...originOf(supabaseUrl), 'https://github.com'],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
  };

  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${sources.join(' ')}`)
    .join('; ');
}

function originOf(url: string | undefined): string[] {
  if (!url) return [];
  try {
    return [new URL(url).origin];
  } catch {
    return [];
  }
}

/** Vercel の既定 (max-age のみ) に includeSubDomains を加える。preload は付けない */
export const STRICT_TRANSPORT_SECURITY = 'max-age=63072000; includeSubDomains';
