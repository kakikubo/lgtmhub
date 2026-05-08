import { Suspense } from 'react';
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
    </div>
  );
}
