import Image from 'next/image';
import Link from 'next/link';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import { resolveUploaderDisplay } from '@/src/lib/profile/resolve-uploader-display';
import type { PublicLgtmImage } from '@/src/types/image';
import type { UserProfile } from '@/src/types/user';

export function ImageCard({
  image,
  profile,
  priority = false,
}: {
  image: PublicLgtmImage;
  profile?: UserProfile;
  priority?: boolean;
}) {
  const uploader = resolveUploaderDisplay(profile);

  return (
    <article className="space-y-2">
      <div
        data-testid="image-card-uploader"
        data-fallback={uploader.isFallback ? 'true' : 'false'}
        className="flex items-center gap-2"
      >
        <Image
          src={uploader.avatarUrl}
          alt={uploader.displayName}
          width={24}
          height={24}
          className="rounded-full bg-gray-100"
          unoptimized
        />
        <span className="text-sm text-gray-700 truncate">{uploader.displayName}</span>
      </div>
      <Link
        href={`/images/${image.id}`}
        data-testid="image-card-link"
        className="block focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
        prefetch={false}
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
