import type { Metadata } from 'next';
import type { PublicLgtmImage } from '@/src/types/image';

const ID_PREFIX_LENGTH = 8;

/**
 * 画像詳細ページの Metadata を組み立てる。
 *
 * 画像にタイトル列が無いため、タブ名は id 先頭 8 桁で一意化する。
 * og:image は Blob 上の LGTM 画像 (WebP) をそのまま使い、width/height を添えて
 * クローラーが画像を取得せずにレイアウトできるようにする。
 * 相対 URL (canonical) は root layout の `metadataBase` で絶対 URL に解決される。
 */
export function buildImageDetailMetadata(
  image: Pick<PublicLgtmImage, 'id' | 'imageUrl' | 'width' | 'height'>,
): Metadata {
  const title = `LGTM 画像 (${image.id.slice(0, ID_PREFIX_LENGTH)})`;
  const path = `/images/${image.id}`;
  const ogImage = {
    url: image.imageUrl,
    width: image.width,
    height: image.height,
    alt: 'LGTM',
  };

  return {
    title,
    alternates: { canonical: path },
    openGraph: {
      title,
      url: path,
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      images: [ogImage],
    },
  };
}
