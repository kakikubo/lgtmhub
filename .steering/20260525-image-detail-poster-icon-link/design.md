# 設計: 画像詳細ページの投稿者アバターをリンク化する

## 変更対象

- `components/uploader-profile-row.tsx`: アバター画像のリンク化。
- `tests/e2e/image-detail.test.ts`: アバターもリンクであることを確認する E2E アサーションを追加。

それ以外 (`resolveUploaderDisplay`, ページコンポーネント, スタイル) は変更しない。

## 実装方針: アバターと表示名を 1 本の `<a>` でラップする

現状はアバター (`<Image>`) と表示名 (`<a>`) が並列で配置されている。これを 1 本の `<a>` で両方を包む構造に変更する。

```tsx
const avatarImage = (
  <Image
    src={uploader.avatarUrl}
    alt=""
    width={24}
    height={24}
    sizes="24px"
    className="rounded-full bg-gray-100"
    unoptimized
  />
);

const profileNode = uploader.profileUrl ? (
  <a
    href={uploader.profileUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group inline-flex items-center gap-2 text-sm text-gray-900 underline-offset-2 focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
  >
    {avatarImage}
    <span className="group-hover:underline">{uploader.displayName}</span>
  </a>
) : (
  <span className="inline-flex items-center gap-2 text-sm text-gray-600">
    {avatarImage}
    <span>{uploader.displayName}</span>
  </span>
);
```

### この方針を採った理由

当初は「アバターと表示名をそれぞれ別の `<a>` で包み、アバター側を `aria-hidden="true"` + `tabIndex={-1}` で装飾リンク化する」案を検討したが、以下の理由で「1 本の `<a>` でラップする」方式に変更した。

1. **biome の `lint/a11y/useAnchorContent` ルール違反**: `<a>` に `aria-hidden="true"` を付けると「スクリーンリーダーから到達不能な空ラベルリンク」とみなされ、lint エラーになる (実装中に判明)。
2. **シンプルな DOM**: リンクが 1 本しかないため、`uploader.locator('a')` の意味が直感的になり、テストも素直に書ける。
3. **アクセシビリティ**: 画像は `alt=""` で装飾扱い、リンクのアクセシブルネームは同じ `<a>` 内のテキスト (表示名) が担う。スクリーンリーダーには 1 つの「`{displayName}` リンク」として読み上げられ、Tab 移動も 1 回で済む。
4. **ホバー時の下線挙動**: `group-hover:underline` を内側 `<span>` にだけ付けることで、従来同様「テキスト部分だけ下線が出る」見た目を維持できる。

### フォールバック時 (`profileUrl` 未定義)

アバターと表示名を `<span>` で包むだけ。リンクは張られず、`data-fallback="true"` で識別可能 (テストでも利用)。

## テスト変更

```ts
// 旧: const anchor = uploader.locator('a').first();
const anchors = uploader.locator('a');
await expect(anchors).toHaveCount(1);
const anchor = anchors.first();
// href / target / rel の検証は従来通り
// 加えて、同じリンク内にアバター画像が含まれていることを確認する
await expect(anchor.locator('img')).toHaveAttribute('src', /.+/);
await expect(anchor).toContainText(/.+/);
```

## リスクと影響範囲

- 影響範囲は `components/uploader-profile-row.tsx` と対応する E2E 1 ファイルに閉じる。
- DOM 構造変更だが、`data-testid="image-detail-uploader"` と `data-fallback` 属性は維持しているため、他のテストや CSS 影響は最小。
- 視覚的には「アイコンの上にもクリック可能領域が拡大する」程度で、レイアウトは現状維持。
- スクリーンリーダー利用者は「`{displayName}` リンク」として認識し、従来と同等以上の体験。
- マウスユーザーは「アイコンをクリックして遷移」できるようになり、要求を満たす。

## 参考: 採用しなかった案

### 案 A: アバター・表示名をそれぞれ別の `<a>` でラップ + アバターを AT から隠す

- biome lint (`lint/a11y/useAnchorContent`) でブロックされた。
- スクリーンリーダーから隠す目的で `aria-hidden="true"` を付けると「リンク本文が空」とみなされる。
- 代わりに `aria-label` を付けると AT に読み上げられて冗長化が発生する。
- どちらに振っても本実装案より良い解にはならないため不採用。

### 案 B: `Link` (next/link) を使う

- 外部リンク (`https://github.com/...`) であり、`next/link` はクライアント側ルーティング向けなので外部 URL には `<a>` を使うのが正しい。既存の名前リンク側も `<a>` を使っているため、それに合わせる。
