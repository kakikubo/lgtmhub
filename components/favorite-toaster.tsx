'use client';

import { useFavoriteState } from '@/components/favorite-store';

/**
 * お気に入り操作の失敗を伝える最小トースト (Issue #198)。
 *
 * 汎用トーストライブラリを入れずに済ませるため、アプリ全体で 1 つだけ live region を持つ。
 * children を取らない葉のクライアントコンポーネントなので、レイアウトに置いても
 * サーバーコンポーネントの Suspense 境界を跨がず、ハイドレーション時の DOM 二重化を招かない
 * (経緯は components/favorite-store.ts のコメント参照)。
 *
 * live region は中身と同時にマウントすると多くのスクリーンリーダーが読み上げないため、
 * 空の `<output>` を常時置き、トースト本体だけを出し入れする (Issue #377)。
 */
export function FavoriteToaster() {
  const { toast } = useFavoriteState();

  return (
    <output
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto block w-fit max-w-[90vw]"
    >
      {toast ? (
        <span
          data-testid="favorite-toast"
          className="block rounded bg-gray-900/90 px-4 py-2 text-sm text-white shadow-lg"
        >
          {toast}
        </span>
      ) : null}
    </output>
  );
}
