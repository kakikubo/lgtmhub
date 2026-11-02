import { Suspense } from 'react';
import { FavoriteToaster } from '@/components/favorite-toaster';
import { Header } from '@/components/header';
import { HeaderSkeleton } from '@/components/header-skeleton';

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
      {/*
        お気に入り操作のトースト。children を包まない兄弟として置くのが重要で、
        クライアントコンポーネントでレイアウトを包むとハイドレーション中に
        一覧・ヘッダーの DOM が一瞬二重になる (components/favorite-store.ts のコメント参照)。
      */}
      <FavoriteToaster />
    </div>
  );
}
