# 設計: 画像ホバーでコピーボタン (Issue #169)

## 現状

```
ImageCard (article.space-y-2)
├─ Link (詳細ページへ) > div > Image
└─ CopyMarkdownButton (常時表示・幅100%)
```

`CopyMarkdownButton` は `imageUrl` のみ受け取り、固定スタイル (`w-full bg-gray-900 ...`) を持つ。詳細ページ (`images/[id]/page.tsx`) でも同コンポーネントを使用。

## 変更方針

### 1. `CopyMarkdownButton` をスタイル可変にする (後方互換)

- 任意の `className?: string` を追加。
- `cn()` (twMerge) で既存の基底クラスとマージ。`className` 未指定時は**従来と完全に同一**のスタイル/挙動 → 詳細ページは無改修。
- オーバーレイ用途では `className` に `w-auto absolute ...` を渡し、`w-full` 等を twMerge で上書きする。
- コピー挙動 (マークダウン生成・クリップボード書き込み・フィードバック) は不変。

### 2. `ImageCard` をホバーオーバーレイ構造へ

```
article.group.relative
├─ Link (詳細ページへ) > div.aspect > Image
└─ CopyMarkdownButton  ← Link の兄弟。absolute で画像右上に重ねる
```

- 親 `article` に `group relative` を付与 (下部要素が無くなるため `space-y-2` は削除)。
- ボタンは `Link` の**後ろの兄弟**として絶対配置 → DOM 上で前面に来るためクリックはボタンに当たり、リンク遷移と競合しない。
- 表示制御 (Tailwind):
  - 非ホバー時: `opacity-0 pointer-events-none` (透明かつクリック透過 → リンク領域を塞がない)
  - `group-hover:opacity-100 group-hover:pointer-events-auto` (ホバーで出現・操作可能)
  - `group-focus-within:opacity-100 group-focus-within:pointer-events-auto` (子の Link がキーボードフォーカスされた段階で出現。ボタン自身の `focus-visible` では Link フォーカス時に出ないため group-focus-within を採用)
  - `transition-opacity duration-150`

### クリック競合の回避

`pointer-events-none` を非表示時に付けることで、透明なボタンが画像クリック (= リンク遷移) を奪わない。ホバー時のみ `pointer-events-auto` となりボタンが前面でクリックを受ける。

## 影響ファイル

- `components/copy-markdown-button.tsx` (props 追加・後方互換)
- `components/image-card.tsx` (構造変更)
- `tests/e2e/image-list.test.ts` (Issue #169 の e2e ケース追加)

## 検証

- `npm test` (vitest) / `npm run lint` / `npm run typecheck`。
- e2e (`tests/e2e/image-list.test.ts`): 非ホバー時 opacity=0、画像ホバーで opacity=1、クリックでフィードバック表示。grid 未表示時はスキップ (既存耐性パターン踏襲)。e2e は Supabase + dev サーバが必要なため CI/手動環境で実行。
