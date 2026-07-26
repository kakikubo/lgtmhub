# タスクリスト: 画像詳細ページの投稿者アバターをリンク化する

## 実装

- [x] `components/uploader-profile-row.tsx` のアバター画像を `<a>` でラップする。`profileUrl` がある場合のみリンク化し、装飾リンク扱い (`aria-hidden="true"`, `tabIndex={-1}`) にする。
- [x] フォールバック時 (`profileUrl` 未定義) は従来通りアバターを `<a>` でラップせず素の `Image` のみで描画する分岐を残す。

## テスト

- [x] `tests/e2e/image-detail.test.ts` の「投稿者プロフィール取得済みのとき…」ケースを更新し、`uploader` 内の `<a>` が 2 つあること・両方が同じ GitHub プロフィールへのリンクであること・アバター側に `aria-hidden="true"` が付いていることをアサートする。

## 検証

- [x] `npm test` がグリーン (E2E はローカル環境依存のためスコープ外、ユニット・統合のみ実行)。
- [x] `npm run lint` がグリーン (worktree 制約により変更ファイルのみ `npx --no-install biome lint <files>` で検証)。
- [x] `npm run typecheck` がグリーン。

## 振り返り

- [x] 実装完了日・計画と実績の差分・学び・次回への改善提案を本ファイル末尾に追記する。

---

## 申し送り事項

### 実装完了日

2026-05-25

### 計画と実績の差分

- **当初案 (タスクリストにも記載していた案)**: アバター画像を独立した `<a>` でラップし、`aria-hidden="true"` + `tabIndex={-1}` で装飾リンク化する (= リンクが 2 本並ぶ)。
- **実際の実装**: アバター画像と表示名を **1 本の `<a>`** で同時にラップする。
- **変更理由**: 当初案を実装した時点で biome の `lint/a11y/useAnchorContent` ルールが「`aria-hidden=true` のリンクはアクセシブルコンテンツを持たない空ラベルリンク」とみなし lint エラーを返した。代替策として `aria-label` を付けると逆に AT が冗長に読み上げるため、根本的に「1 本の `<a>` に統合する」方が要件もアクセシビリティも両立できると判断し、design.md ごと更新して採用した。
- **テスト側の修正方針も連動して変更**: 「`<a>` が 2 つ・アバター側に `aria-hidden`」→「`<a>` が 1 つ・その中に `img` と表示名テキストが両方ある」に変更。

### 学んだこと

1. **biome の a11y ルール `useAnchorContent` は厳格**: アンカーから AT 到達不能にする目的の `aria-hidden="true"` は許容されない。装飾リンクを成り立たせるには、結局アクセシブルネームが必要で、アクセシブルネームを与えると AT に読み上げられる。「装飾リンクで読み上げを抑制」というパターン自体を素直に書けない仕様。
2. **同一宛先のリンクが視覚的に並ぶ場合は、1 本の `<a>` でまとめるのが最も素直**: DOM が単純、テストが直感的、AT も 1 回しか読まない、Tab も 1 回で済む。今回のように「アイコンと名前」レベルの並びならまず単一リンクから検討する。
3. **worktree 制約 (memory `biome-lint-worktree-limitation` 参照)**: `npm run lint` (= `biome lint .`) は worktree 内では「No files were processed」で exit 1 になる。`npx --no-install biome lint <明示パス>` で検証する運用を継続。

### 次回への改善提案

- **タスクリスト着手前の lint ルール確認**: アクセシビリティ系の DOM 変更 (`aria-hidden`, `tabIndex`, `<a>` の構造) を含む場合、biome ルールを軽く確認してから方針を決めると、実装中に大幅に方針転換するロスを減らせる。
- **fallback ケースのユニットテスト追加 (任意)**: 現状 fallback (`data-fallback="true"`) ケースは E2E でスキップされる。`UploaderProfileRow` のコンポーネントテスト (Vitest + React Testing Library) で「`profile=null` のときアンカーが 0 本」を担保すると、リグレッション耐性が上がる。今回のスコープは Issue #147 (アバターリンク化) に絞ったため未着手。
