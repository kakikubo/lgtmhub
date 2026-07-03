# タスクリスト

## 🚨 タスク完全完了の原則

このファイルの全タスクが完了するまで作業を継続すること。スキップは技術的理由のみ許可 (理由を明記)。

---

## フェーズ1: PR 1 — CLAUDE.md 配置

- [x] ブランチ feat/directory-claude-md を main から作成
- [x] ルート CLAUDE.md を承認済みドラフトで改訂
- [x] app/api/CLAUDE.md を新規作成
- [x] src/CLAUDE.md を新規作成
- [x] supabase/CLAUDE.md を新規作成
- [x] ~~docs/repository-structure.md のパスエイリアス記述を tsconfig.json の実態に修正~~（前提誤りにより不要: 実物を確認したところ docs は既に `"@/*": ["./*"]` と正しく記載していた。調査サブエージェントの報告が誤り）
- [ ] .steering/20260703-directory-claude-md/ をコミットに含める
- [ ] コミット・push・PR 作成 (GHTKN_APP=C-FO/write、--body-file 使用)

## フェーズ2: PR 2 — doc 作成系 skill の削除

- [ ] ブランチ chore/remove-doc-authoring-skills を main から作成
- [ ] .claude/architecture-design/ を削除
- [ ] .claude/development-guidelines/ を削除
- [ ] .claude/functional-design/ を削除
- [ ] .claude/glossary-creation/ を削除
- [ ] .claude/prd-writing/ を削除
- [ ] .claude/repository-structure/ を削除
- [ ] .claude/commands/setup-project.md を削除
- [ ] 残存ファイルから削除対象への参照が残っていないことを grep で確認
- [ ] コミット・push・PR 作成 (GHTKN_APP=C-FO/write、--body-file 使用)

## フェーズ3: 品質チェック

- [ ] PR 1 ブランチで pnpm run check / typecheck が通ることを確認 (Markdown のみの変更だが念のため)
- [ ] 両 PR の CI ステータスを確認

## フェーズ4: 振り返り

- [ ] 実装後の振り返り (このファイルの下部に記録)

---

## 実装後の振り返り

### 実装完了日
{YYYY-MM-DD}

### 計画と実績の差分

### 学んだこと

### 次回への改善提案
