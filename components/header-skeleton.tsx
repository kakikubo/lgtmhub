// Header の高さ・横幅を保つだけの placeholder。Suspense fallback として一瞬しか表示されないが、
// レイアウトシフトを抑えるため Header と同じ <header> ランドマーク・パディング・ロゴ位置で揃える。
export function HeaderSkeleton() {
  return (
    <header className="border-b" data-testid="header-skeleton">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-semibold">LGTMHub</span>
        <div className="h-8 w-24" />
      </div>
    </header>
  );
}
