'use client';

import { Heart } from 'lucide-react';
import { toggleFavorite, useFavoriteState } from '@/components/favorite-store';
import { cn } from '@/src/lib/utils';

const LABEL_ADD = 'お気に入りに追加';
const LABEL_REMOVE = 'お気に入りから外す';

/**
 * お気に入りトグル (Issue #198)。
 *
 * - 未登録 = 輪郭のハート、登録済 = 塗りつぶし
 * - 未ログインでも常に表示し、押下で GitHub ログインへ誘導する (ストアが判断する)
 * - 状態は components/favorite-store.ts が保持し、更新はオプティミスティック
 * - ログイン状態が判明するまでは操作不能 (ログイン済みユーザーを OAuth へ飛ばさないため)
 */
export function FavoriteButton({
  lgtmImageId,
  className,
  variant = 'text',
}: {
  lgtmImageId: string;
  className?: string;
  variant?: 'text' | 'icon';
}) {
  const { favoritedIds, pendingIds, authResolved } = useFavoriteState();
  const favorited = favoritedIds.has(lgtmImageId);
  const disabled = !authResolved || pendingIds.has(lgtmImageId);
  const label = favorited ? LABEL_REMOVE : LABEL_ADD;

  const sharedProps = {
    type: 'button',
    onClick: () => toggleFavorite(lgtmImageId),
    disabled,
    'data-testid': 'favorite-button',
    'data-favorite-state': favorited ? 'on' : 'off',
    'aria-pressed': favorited,
    'aria-label': label,
    title: label,
  } as const;

  if (variant === 'icon') {
    return (
      <button
        {...sharedProps}
        className={cn(
          'rounded-full bg-gray-900/70 p-1.5 text-white hover:bg-gray-900/90 disabled:opacity-50',
          className,
          // 一覧カードではホバー時のみ出るオーバーレイ (className 側で opacity-0) に載るが、
          // 登録済みのハートは「一目で分かる」ことが要件なので常時表示へ上書きする。
          // cn (tailwind-merge) は後勝ちなので className より後ろに置く必要がある。
          favorited && 'opacity-100 pointer-events-auto',
        )}
      >
        <Heart
          className={cn('h-5 w-5', favorited && 'fill-current text-rose-400')}
          aria-hidden="true"
        />
      </button>
    );
  }

  return (
    <button
      {...sharedProps}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50',
        className,
      )}
    >
      <Heart
        className={cn('h-4 w-4', favorited && 'fill-current text-rose-500')}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}
