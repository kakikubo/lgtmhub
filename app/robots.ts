import type { MetadataRoute } from 'next';
import { getSiteUrl, isIndexableEnvironment } from '@/src/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  // Preview / ローカルは本番と同じコンテンツが別 URL で見えるため、全面的にクロールさせない
  if (!isIndexableEnvironment()) {
    return { rules: { userAgent: '*', disallow: '/' } };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/images/new', '/favorites'],
    },
    sitemap: new URL('/sitemap.xml', getSiteUrl()).href,
  };
}
