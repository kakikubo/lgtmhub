import { describe, expect, it } from 'vitest';
import { buildImageDetailMetadata } from '@/src/lib/metadata/image-detail';

const IMAGE = {
  id: '0f8fad5b-d9cb-469f-a165-70867728950e',
  imageUrl: 'https://abc.public.blob.vercel-storage.com/lgtm/x.webp',
  width: 1024,
  height: 768,
};

const EXPECTED_OG_IMAGE = {
  url: IMAGE.imageUrl,
  width: 1024,
  height: 768,
  alt: 'LGTM',
};

describe('buildImageDetailMetadata', () => {
  it('title は id 先頭 8 桁で一意化する', () => {
    expect(buildImageDetailMetadata(IMAGE).title).toBe('LGTM 画像 (0f8fad5b)');
  });

  it('canonical と og:url に詳細ページのパスを入れる', () => {
    const metadata = buildImageDetailMetadata(IMAGE);

    expect(metadata.alternates?.canonical).toBe(`/images/${IMAGE.id}`);
    expect(metadata.openGraph?.url).toBe(`/images/${IMAGE.id}`);
  });

  it('og:image / twitter:image に画像 URL と width/height を入れる', () => {
    const metadata = buildImageDetailMetadata(IMAGE);

    expect(metadata.openGraph?.images).toEqual([EXPECTED_OG_IMAGE]);
    expect(metadata.twitter).toMatchObject({
      card: 'summary_large_image',
      images: [EXPECTED_OG_IMAGE],
    });
  });
});
