import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/src/lib/site-url';
import { getSitemapImageIds } from '@/src/services/cache/list-sitemap-image-ids';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const ids = await getSitemapImageIds();

  return [
    { url: new URL('/', siteUrl).href },
    ...ids.map((id) => ({ url: new URL(`/images/${id}`, siteUrl).href })),
  ];
}
