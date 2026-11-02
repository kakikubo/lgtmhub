const LOCAL_SITE_URL = 'http://localhost:3000';

/**
 * OGP / canonical / sitemap / robots の絶対 URL に使うサイトのベース URL を返す。
 *
 * Vercel のシステム環境変数から解決するため、デプロイ環境ごとの env 設定は不要。
 * - Production: 本番ドメイン (`VERCEL_PROJECT_PRODUCTION_URL`)
 * - Preview: デプロイごとの URL (`VERCEL_URL`)
 * - ローカル / CI: `http://localhost:3000`
 */
export function getSiteUrl(): URL {
  const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.VERCEL_ENV === 'production' && productionHost) {
    return new URL(`https://${productionHost}`);
  }

  const deploymentHost = process.env.VERCEL_URL;
  if (deploymentHost) {
    return new URL(`https://${deploymentHost}`);
  }

  return new URL(LOCAL_SITE_URL);
}

/** 検索エンジンにインデックスさせてよい環境 (= Vercel の Production) か */
export function isIndexableEnvironment(): boolean {
  return process.env.VERCEL_ENV === 'production';
}
