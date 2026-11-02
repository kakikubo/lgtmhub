import Image from 'next/image';
import { resolveUploaderDisplay } from '@/src/lib/profile/resolve-uploader-display';
import type { UserProfile } from '@/src/types/user';

/**
 * 画像詳細ページ用の投稿者行 (`投稿者： アバター 表示名 (link)`)。
 *
 * - `profile` が `null` (取得失敗 / 連携解除) の場合は resolveUploaderDisplay の fallback により
 *   `Unknown` + デフォルトアバターが表示され、リンクは張られない
 * - アバターと表示名を 1 本の `<a>` でラップすることでアイコンクリックでも GitHub プロフィールへ
 *   遷移できる。アバターは装飾扱い (`alt=""`) のため、リンクのアクセシブルネームは隣接する
 *   表示名テキストが担う (同一宛先のリンクが 2 つ並ぶ冗長化を避ける)
 * - LCP の主役は中央の LGTM 画像のため、アバターには `priority` を付けない
 */
export function UploaderProfileRow({ profile }: { profile: UserProfile | null }) {
  const uploader = resolveUploaderDisplay(profile ?? undefined);

  const avatarImage = (
    <Image
      src={uploader.avatarUrl}
      alt=""
      width={24}
      height={24}
      sizes="24px"
      className="rounded-full bg-gray-100"
      unoptimized
    />
  );

  const profileNode = uploader.profileUrl ? (
    <a
      href={uploader.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 text-sm text-gray-900 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
    >
      {avatarImage}
      <span className="group-hover:underline">{uploader.displayName}</span>
    </a>
  ) : (
    <span className="inline-flex items-center gap-2 text-sm text-gray-600">
      {avatarImage}
      <span>{uploader.displayName}</span>
    </span>
  );

  return (
    <div
      data-testid="image-detail-uploader"
      data-fallback={uploader.isFallback ? 'true' : 'false'}
      className="flex items-center gap-2 text-sm"
    >
      <span className="text-gray-600">投稿者：</span>
      {profileNode}
    </div>
  );
}
