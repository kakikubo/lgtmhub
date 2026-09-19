# タスクリスト: glossary.md の物理クリーンアップ参照を「機能8」に修正

## 実装

- [x] `docs/glossary.md:155`（論理削除の説明）を `PRD 機能8` に修正
- [x] `docs/glossary.md:514`（画像ステータス遷移テーブルの `deleted` 行）を `PRD 機能8` に修正
- [x] `docs/glossary.md:523`（mermaid 状態遷移図のラベル）を `PRD 機能8` に修正
- [x] `docs/glossary.md:555`（LgtmImage の `deletedAt` 説明）を `PRD 機能8` に修正

## 検証

- [x] `grep -n '機能9' docs/glossary.md` が 0 件であることを確認
- [x] `grep -rn '機能8\|機能9' docs/` の全参照が PRD の採番と一致することを確認
- [x] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` を実行
- [x] implementation-validator で変更内容を検証

## 申し送り事項

**実装完了日**: 2026-09-20

**計画と実績の差分**: なし。design.md の変更対象テーブル（155/514/523/555 行）と
実際の diff が完全一致した。

**検証結果**:
- `grep -n '機能9' docs/glossary.md` → 0 件
- `grep -rn '機能8\|機能9' docs/` → 残る参照は PRD の採番と一致
  （repository-structure.md:580 の「機能9: ファイルアップロード対応」は正しい参照）
- `pnpm exec biome check src app components docs` → 63 files, no fixes
- `pnpm run typecheck` → エラーなし
- `pnpm run test` → 43 files / 422 tests passed
- implementation-validator → 重大な問題なし

**学んだこと**:
- worktree では `pnpm run check`（`biome check .`）が
  「No files were processed」で exit 1 になる。明示パス指定で検証する必要がある
  （既知の制約。CI では発生しない）
- 用語集のような横断ドキュメントは、参照先ドキュメントの採番変更に追従しそこねやすい。
  同一ファイル内（155 行と 168 行）で番号が食い違っていたのがその痕跡

**次回への改善提案**:
- PRD の機能番号への参照表記が `PRD 機能N` / `PRD機能N` / `P1機能N` と揺れている。
  今回は機能8/9 のみ統一したが、他の機能番号（`PRD機能2` / `PRD機能6` 等）には
  揺れが残る。docs 全体の表記統一は別 Issue として切り出すのが適切
- PRD の機能番号をドキュメントから参照する箇所は、番号だけでなく機能名も併記すると
  番号ズレに気づきやすい（155 行は機能名が併記されていたため誤りを発見できた）
