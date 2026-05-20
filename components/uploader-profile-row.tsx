import Image from 'next/image';
import { resolveUploaderDisplay } from '@/src/lib/profile/resolve-uploader-display';
import type { UserProfile } from '@/src/types/user';

/**
 * 画像詳細ページ用の投稿者行 (`投稿者： アバター 表示名 (link)`)。
 *
 * - `profile` が `null` (取得失敗 / 連携解除) の場合は resolveUploaderDisplay の fallback により
 *   `Unknown` + デフォルトアバターが表示され、リンクは張られない
 * - アバターは装飾扱い (`alt=""`) とし、隣接するテキストリンクで投稿者名を表現する (アクセシビリティ)
 * - LCP の主役は中央の LGTM 画像のため、アバターには `priority` を付けない
 */
export function UploaderProfileRow({ profile }: { profile: UserProfile | null }) {
  const uploader = resolveUploaderDisplay(profile ?? undefined);

  const nameNode = uploader.profileUrl ? (
    <a
      href={uploader.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-gray-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
    >
      {uploader.displayName}
    </a>
  ) : (
    <span className="text-sm text-gray-600">{uploader.displayName}</span>
  );

  return (
    <div
      data-testid="image-detail-uploader"
      data-fallback={uploader.isFallback ? 'true' : 'false'}
      className="flex items-center gap-2 text-sm"
    >
      <span className="text-gray-600">投稿者：</span>
      <Image
        src={uploader.avatarUrl}
        alt=""
        width={24}
        height={24}
        sizes="24px"
        className="rounded-full bg-gray-100"
        unoptimized
      />
      {nameNode}
    </div>
  );
}
