import Image from 'next/image';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import type { PublicLgtmImage } from '@/src/types/image';

export function ImageCard({ image }: { image: PublicLgtmImage }) {
  return (
    <article className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-50">
        <Image
          src={image.imageUrl}
          alt="LGTM"
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="object-cover"
        />
      </div>
      <CopyMarkdownButton imageUrl={image.imageUrl} />
    </article>
  );
}
