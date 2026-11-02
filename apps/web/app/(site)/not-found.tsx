import Link from 'next/link';

// (site) 配下で notFound() が呼ばれたときの 404。(site)/layout.tsx の内側に描画されるためヘッダーも出る。
// どのルートにも一致しない URL はルートの既定 404 のまま (Issue #373 の Non-goals)
export default function SiteNotFound() {
  return (
    <div
      data-testid="not-found-page"
      className="mx-auto max-w-6xl px-4 py-16 flex flex-col items-center gap-4 text-center"
    >
      <h1 className="text-xl font-semibold">ページが見つかりません</h1>
      <p className="text-sm text-gray-600">
        お探しのページは削除されたか、URL が間違っている可能性があります。
      </p>
      <Link
        href="/"
        data-testid="not-found-home-link"
        className="text-sm text-gray-600 hover:text-gray-900"
      >
        トップページへ戻る
      </Link>
    </div>
  );
}
