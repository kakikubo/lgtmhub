// cacheComponents 下で登録ページ本体 (cookies 依存の認証チェック + redirect) を
// Suspense 境界で包むための loading セグメント。静的シェルとして先行配信される。
// 実体ページ (max-w-2xl) と同じ骨格に揃え、ストリーミング切替時のレイアウトシフトを防ぐ。
export default function Loading() {
  return (
    <section className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <div className="h-8 w-64 rounded bg-gray-100" />
        <div className="h-4 w-full rounded bg-gray-100" />
      </header>
      <div className="h-40 w-full rounded border bg-gray-100" />
    </section>
  );
}
