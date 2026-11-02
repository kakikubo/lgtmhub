// cacheComponents 下で詳細ページ本体 (params / cookies 依存の動的レンダリング) を
// Suspense 境界で包むための loading セグメント。静的シェルとして先行配信される。
// 実体 DetailView (max-w-3xl) と同じ骨格に揃え、ストリーミング切替時のレイアウトシフトを防ぐ。
export default function Loading() {
  return (
    <section data-testid="image-detail-skeleton" className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="h-5 w-24 rounded bg-gray-100" />
      <div className="mx-auto aspect-[4/3] max-w-[400px] rounded border bg-gray-100" />
      <div className="h-10 w-40 rounded bg-gray-100" />
      <div className="h-10 w-full rounded bg-gray-100" />
    </section>
  );
}
