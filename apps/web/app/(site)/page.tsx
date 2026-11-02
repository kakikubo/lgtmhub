import { Suspense } from 'react';
import { HomeContent } from '@/components/home-content';
import { ImageGridSkeleton } from '@/components/image-grid-skeleton';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-3 py-2">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
          Make every LGTM count.
        </h1>
        <p className="text-base md:text-lg text-gray-700 max-w-2xl leading-relaxed">
          GitHub Pull Request のレビューコメントにそのままコピペできる LGTM 画像を、
          みんなでシェアする掲示板です。 画像の閲覧とマークダウンのコピーはログイン不要、
          画像を登録するには GitHub でログインしてください。
        </p>
      </header>

      <Suspense fallback={<ImageGridSkeleton />}>
        <HomeContent />
      </Suspense>
    </section>
  );
}
