# 要求: コピーボタンをアイコン化する (Issue #174)

## 背景
画像一覧グリッドカードのコピーボタン (#169) は横長テキストボタン。これをコンパクトなアイコンボタンへ変更する。

## スコープ
- 対象: 画像一覧グリッドカード (`ImageCard` / `CopyMarkdownButton`)
- 対象外: 画像詳細ページ (`/images/[id]`) — テキストボタンのまま維持
- コピー内容は変更しない (`![LGTM](画像URL)`)

## 仕様
### 表示・挙動
- 表示タイミング: 画像ホバー / キーボードフォーカス時のみ (既存 `group-hover` / `group-has-[:focus-visible]` を維持)
- 配置: 画像右上 (`absolute right-2 top-2`)
- アイコン: lucide-react `Copy` (導入済み)
- 見た目: 半透明の暗い背景の丸ボタン (`bg-gray-900/70` + 白アイコン)、32px 角程度 (`p-1.5`)

### コピー完了フィードバック
- コピー成功後アイコンを `Check` に変化、2秒後 `Copy` へ戻す
- 既存 `copied` 状態 (2秒タイマー、`data-copy-state`) を流用

### アクセシビリティ
- `aria-label` / `title`: 通常時「マークダウンをコピー」、コピー後「コピーしました」

## テスト
- `tests/e2e/image-list.test.ts` をアイコン化に合わせ更新
- 表示テキスト依存検証を `data-testid="copy-markdown-button"` / `data-copy-state` ベースに置換
- コピー完了は `data-copy-state="copied"` で判定
- 既存4テスト構造 (ホバー表示 / フォーカス / コピー完了 / クリック後ホバー復帰) を維持

## 受け入れ条件
Issue #174 のチェックリストに準拠。
