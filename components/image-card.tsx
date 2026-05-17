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

  const uploaderInner = (
    <Image
      src={uploader.avatarUrl}
      alt=""
      width={24}
      height={24}
      className="rounded-full bg-gray-100"
      unoptimized
    />
  );

  return (
    <article className="space-y-2">
      {uploader.profileUrl ? (
        <a
          href={uploader.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${uploader.displayName} の GitHub プロフィール`}
          data-testid="image-card-uploader"
          data-fallback="false"
          className="group flex items-center gap-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
        >
          {uploaderInner}
        </a>
      ) : (
        <div
          data-testid="image-card-uploader"
          data-fallback="true"
          className="flex items-center gap-2"
        >
          {uploaderInner}
        </div>
      )}
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
