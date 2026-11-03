'use client';

import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import type { PublicLgtmImage } from '@/src/types/image';

function EmptyState() {
  return (
    <div
      data-testid="favorites-empty"
      className="rounded border border-dashed bg-gray-50 px-6 py-12 text-center text-sm text-gray-600"
    >
      <p>まだお気に入りがありません。</p>
      <p className="mt-2">気に入った LGTM 画像のハートを押すと、ここに集まります。</p>
    </div>
  );
}

function LoadErrorState() {
  return (
    <div
      data-testid="favorites-error"
      className="rounded border border-dashed border-amber-300 bg-amber-50 px-6 py-12 text-center text-sm text-amber-800"
    >
      <p>現在お気に入りを読み込めません。</p>
      <p className="mt-2">時間をおいて再度お試しください。</p>
    </div>
  );
}

interface FavoriteImagesProps {
  initialImages: PublicLgtmImage[];
  initialNextCursor: string | null;
  loadError: boolean;
}

/**
 * お気に入り一覧の本体 (Issue #198)。
 *
 * トップと同じ ImageGrid / LoadMoreButton を流用し、取得先だけ `/api/favorites` に差し替える。
 * 解除してもカードはその場から消さない (輪郭ハートに変わるだけ)。誤操作をその場で取り消せ、
 * リロードすれば一覧から消えるため状態としても破綻しない。
 */
export function FavoriteImages({
  initialImages,
  initialNextCursor,
  loadError,
}: FavoriteImagesProps) {
  if (loadError) {
    return <LoadErrorState />;
  }
  if (initialImages.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6" data-testid="favorite-images">
      <ImageGrid images={initialImages} testId="favorites-grid" />
      {initialNextCursor ? (
        <LoadMoreButton initialCursor={initialNextCursor} endpoint="/api/favorites" />
      ) : null}
    </div>
  );
}
