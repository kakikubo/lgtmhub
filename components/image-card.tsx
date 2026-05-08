import Image from 'next/image';
import Link from 'next/link';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import type { PublicLgtmImage } from '@/src/types/image';

export function ImageCard({
  image,
  priority = false,
}: {
  image: PublicLgtmImage;
  priority?: boolean;
}) {
  return (
    <article className="space-y-2">
      <Link
        href={`/images/${image.id}`}
        data-testid="image-card-link"
        className="block focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
      >
        <div className="relative aspect-[266/199] overflow-hidden rounded border bg-gray-50">
          <Image
            src={image.imageUrl}
            alt="LGTM"
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
            className="object-cover"
            priority={priority}
            unoptimized
          />
        </div>
      </Link>
      <CopyMarkdownButton imageUrl={image.imageUrl} />
    </article>
  );
}
