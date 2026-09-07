import { Suspense } from 'react';
import { FavoritesContent } from '@/components/favorites-content';
import { ImageGridSkeleton } from '@/components/image-grid-skeleton';

export const metadata = {
  title: 'お気に入り | LGTMHub',
};

export default function FavoritesPage() {
  return (
    <section data-testid="favorites-page" className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2 py-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">お気に入り</h1>
        <p className="text-sm text-gray-700">
          ハートを押して登録した LGTM 画像を、登録した新しい順に表示します。
        </p>
      </header>

      {/* 認証参照 (cookies) は Suspense の内側に閉じ込め、cacheComponents 下の静的シェルを壊さない */}
      <Suspense fallback={<ImageGridSkeleton />}>
        <FavoritesContent />
      </Suspense>
    </section>
  );
}
