# タスクリスト: 画像ホバーでコピーボタン (Issue #169)

## 実装

- [x] `CopyMarkdownButton` に任意 `className` prop を追加し `cn()` でマージ (後方互換)
- [x] `ImageCard` を `group relative` + ホバーオーバーレイ構造へ変更し、下部の常時表示ボタンを廃止

## テスト

- [x] `tests/e2e/image-list.test.ts` に Issue #169 の e2e ケースを追加 (非ホバー opacity=0 → ホバー opacity=1 → クリックでフィードバック)

## 検証

- [x] `implementation-validator` で品質検証 (総合 4.8/5。指摘の `group-focus-within` 化と keyboard e2e 追加を反映)
- [x] `npm test` (196 passed) / `npm run lint` (clean) / `npm run typecheck` (OK) がすべて成功
- [x] e2e (Issue #169 3 ケース) を本番ビルド + dev 双方で実行し全パス

## 振り返り

- [x] 申し送り事項を記載 (下記)

---

## 申し送り事項

### 実装完了日
2026-06-04

### 計画と実績の差分
- 計画どおり 2 ファイル (`copy-markdown-button.tsx`, `image-card.tsx`) + e2e で完了。
- `CopyMarkdownButton` は `className` 任意追加 + `cn()` マージで後方互換を確保し、詳細ページ (`images/[id]/page.tsx`) は無改修で従来表示を維持。
- 当初 `focus-visible:` で実装したが、検証指摘により `group-focus-within:` へ変更 (Link フォーカス段階でオーバーレイが出る正しい挙動に修正)。keyboard フォーカス用 e2e も追加。

### 学んだこと
- トップページは Suspense ストリーミングのため、`page.goto('/')` 直後の `grid.isVisible()` は skeleton 段階で false になり、skip-guard が誤発火する (テストが silent skip)。`grid.or(empty).or(error)` の `toBeVisible()` で確定を待ってから判定する必要がある。新規 e2e は `gotoAndRequireGrid` ヘルパーでこれを回避した。
- オーバーレイのクリック競合は、非表示時 `pointer-events-none` + ホバー時 `pointer-events-auto` で解消。透明ボタンがリンククリックを奪わない。

### 既知の制約 / 次回への改善提案
- **[別Issue推奨] 既存 e2e の隠れた失敗**: `image-list.test.ts` の「先頭カードの img に fetchpriority=high / loading=eager が付く」テスト (Issue #63 関連) は、ストリーミングレースで**ローカルでは常に skip** されていたが、grid 確定を待たせると **origin/main の base でも失敗**することを確認した (本変更とは無関係の既存回帰)。next/image の `priority` が一覧先頭カードで反映されていない可能性がある。1PR=1関心事のため本PRでは触らず、別Issueでの調査を推奨。
- **タッチデバイス**: hover を持たない端末ではオーバーレイは出ない。画像タップ→詳細ページの常時表示コピーボタンでコピー可能なため手段は確保 (要件記載済み)。
- **[提案/別PR] `CopyMarkdownButton` の `w-full` をベースから外す**案 (検証提案1) は見た目の意図明確化のみで、後方互換上は不要。独立した関心事のため見送り。
