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
    <article className="group relative">
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
      {/*
        画像へホバー (またはキーボードフォーカス) したときだけ右上に出現するオーバーレイ。
        Link の後ろの兄弟として絶対配置することで前面に重なり、クリックがリンク遷移と競合しない。
        非表示時は pointer-events-none で透過させ、画像クリック (= 詳細遷移) を奪わない。
        キーボード表示は group-focus-within ではなく group-has-[:focus-visible] を使う:
        前者だとマウスでボタンをクリックした後もボタンが :focus を保持し続け、
        ホバーを外してもオーバーレイが消えない (Issue #169 の不具合)。:focus-visible は
        キーボード操作時のみ立つため、マウスクリック後はホバーが外れた時点で確実に消える。
      */}
      <CopyMarkdownButton
        imageUrl={image.imageUrl}
        variant="icon"
        className="absolute right-2 top-2 opacity-0 pointer-events-none transition-opacity duration-150 group-hover:opacity-100 group-hover:pointer-events-auto group-has-[:focus-visible]:opacity-100 group-has-[:focus-visible]:pointer-events-auto"
      />
    </article>
  );
}
