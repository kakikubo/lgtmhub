import { Suspense } from 'react';
import { HomeContent } from '@/components/home-content';
import { ImageGridSkeleton } from '@/components/image-grid-skeleton';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">LGTM 画像一覧</h1>
      </header>

      <Suspense fallback={<ImageGridSkeleton />}>
        <HomeContent />
      </Suspense>
    </section>
  );
}
