# 設計: コピーボタンのアイコン化

## 方針
`CopyMarkdownButton` は一覧グリッドと詳細ページで共有されている。詳細ページはテキスト表示を維持する必要があるため、`variant` prop を追加して両対応する。最小変更を優先。

## 変更点

### `components/copy-markdown-button.tsx`
- `variant?: 'text' | 'icon'` prop を追加 (デフォルト `'text'`)
- `copied` 状態・2秒タイマー・`data-copy-state` / `data-testid="copy-markdown-button"` は共通で維持
- `variant === 'icon'`:
  - ラベル文字列 (通常時「マークダウンをコピー」/ コピー後「コピーしました」) を `aria-label` / `title` に設定
  - 中身は lucide-react の `Copy` / `Check` アイコン (`aria-hidden`)
  - 丸ボタンスタイル `bg-gray-900/70` + 白アイコン + `p-1.5` + `rounded-full`
- `variant === 'text'`: 現状のテキストボタン (`copy-feedback` span 含む) をそのまま維持

### `components/image-card.tsx`
- `<CopyMarkdownButton variant="icon" ... />` を渡す
- オーバーレイ用 className から `w-auto` を除去 (アイコンは固定サイズ)。`opacity` / `pointer-events` / `group-*` 表示制御は維持

### `app/(site)/images/[id]/page.tsx`
- 変更なし (デフォルト `text` のまま)

## テスト (`tests/e2e/image-list.test.ts`)
- 「コピー完了フィードバック」テスト: `copy-feedback` 可視性判定を `data-copy-state="copied"` 判定へ置換
- 他3テスト (ホバー / フォーカス / クリック後ホバー復帰) は testid / CSS ベースのため構造維持
