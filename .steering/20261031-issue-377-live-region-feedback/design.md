# お気に入りトーストとコピー結果をスクリーンリーダーへ通知する (#377)

## 結論

live region は「常時マウントし、中身だけ差し替える」に統一する。`FavoriteToaster` は空の `<output aria-live="polite">` を常に置き、トースト本体だけを出し入れする。`CopyMarkdownButton` はボタンの隣に視覚的に隠した `role="status"` を常時置き、成功・失敗の文言をそこへ書く。失敗は見た目にも出し、表示の解除は `useEffect` の cleanup 付きタイマーで行う。

## 設計

- **FavoriteToaster**: 外側の `<output aria-live="polite">` は位置指定だけを持ち常時描画する。背景や余白は内側の `<span data-testid="favorite-toast">` に移し、`toast` があるときだけ描画する。`favorite-toast` の有無で判定する既存テストは変更しない
- **CopyMarkdownButton**: 状態を `'idle' | 'copied' | 'failed'` にし、`data-copy-state` にそのまま出す
  - 成功は「コピーしました」、失敗は「コピーできませんでした」。text 版はボタンの文言を、icon 版はアイコン（`Check` / `X`）と `aria-label`・`title` を切り替える
  - 通知はボタンの兄弟の `<span role="status" className="sr-only">` で行う。ボタン内に置くと icon 版は `aria-label` に名前を上書きされ、live region としての扱いもスクリーンリーダー依存になる。`sr-only` は絶対配置なので、カードのオーバーレイの flex レイアウトに影響しない
  - `idle` 以外になったら `useEffect` で 2 秒後に `idle` へ戻し、cleanup で `clearTimeout` する。連打時はタイマーが張り直され、アンマウント後の setState も起きない
- **ヘッダー**: アバターの `alt` を `""` にする。直後に表示名のテキストがあり、二重に読み上げられるため

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| コピー結果も `FavoriteToaster` の共有トーストで出す | お気に入り専用ストアに無関係な状態が入る。成功のたびに画面下にトーストが出るのも過剰 |
| icon 版は `aria-label` の書き換えだけで通知する | 名前の変更は多くのスクリーンリーダーが読み上げない（Issue の指摘そのもの） |
| カードごとではなく画面に 1 つの live region を置く | コピー用のグローバルストアが新たに要る。空の `sr-only` 要素がカード数だけ増えるコストの方が小さい |

## Non-goals

- 2 秒以内に同じ結果を繰り返したときの再読み上げ（文言が変わらないため読み上げられない）
- 汎用トースト基盤の導入
- クリップボード API 非対応環境でのフォールバックコピー（`execCommand` 等）
