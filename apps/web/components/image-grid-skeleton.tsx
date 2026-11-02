// xl:grid-cols-4 で 2 行分を確保し、ファーストビュー高さを安定させる。
// 実体の ImageGrid と同じ <ul>+<li> 構造に揃え、Suspense 切替時のリスト意味論ぶれを防ぐ。
const SKELETON_COUNT = 8;

export function ImageGridSkeleton() {
  return (
    <ul
      data-testid="image-grid-skeleton"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: 静的プレースホルダーで並び替えが起きないため index で十分
        <li key={index} className="space-y-2">
          <div className="relative aspect-[4/3] rounded border bg-gray-100" />
          <div className="h-8 w-full rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}
