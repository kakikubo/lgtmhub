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
- [x] .steering/20260703-directory-claude-md/ をコミットに含める
- [x] コミット・push・PR 作成 (GHTKN_APP=C-FO/write、--body-file 使用) → PR #230

## フェーズ2: PR 2 — doc 作成系 skill の削除

- [x] ブランチ chore/remove-doc-authoring-skills を main から作成
- [x] .claude/architecture-design/ を削除
- [x] .claude/development-guidelines/ を削除
- [x] .claude/functional-design/ を削除
- [x] .claude/glossary-creation/ を削除
- [x] .claude/prd-writing/ を削除
- [x] .claude/repository-structure/ を削除
- [x] .claude/commands/setup-project.md を削除
- [x] 残存ファイルから削除対象への参照が残っていないことを grep で確認 (残りは main の CLAUDE.md の /setup-project 言及 2 箇所のみで、PR #230 が除去する。PR 本文に #230 先行マージを明記)
- [x] コミット・push・PR 作成 (GHTKN_APP=C-FO/write、--body-file 使用) → PR #231

## フェーズ3: 品質チェック

- [x] PR 1 ブランチで pnpm run check / typecheck が通ることを確認 (ホストの pnpm がバージョンスイッチ失敗のため node_modules/.bin の biome / tsc を直接実行、両方 exit 0)
- [x] 両 PR の CI ステータスを確認 (lint-and-typecheck / test / danger / security ともパス、e2e は実行中 → 完了を監視して最終報告)

## フェーズ4: 振り返り

- [x] 実装後の振り返り (このファイルの下部に記録)

---

## 実装後の振り返り

### 実装完了日
2026-07-03

### 計画と実績の差分

**計画と異なった点**:
- docs/repository-structure.md のパスエイリアス修正タスクは前提誤りで不要だった (docs は既に `"@/*": ["./*"]` と正しく、調査サブエージェントの報告が誤り)。一次ソース確認で発覚
- ホストの pnpm が Corepack のバージョンスイッチに失敗するため、検証は node_modules/.bin の biome / tsc を直接実行した (devcontainer 外での既知の制約)

**新たに必要になったタスク**:
- tasklist.md が PR1 ブランチにのみ存在するため、PR2 作業前に進捗コミットを追加してブランチを切り替えた

### 学んだこと

**技術的な学び**:
- あり/なし検証は「書く価値のある規約」を大幅に絞り込む (候補 16+27 項目 → 採用は 3 ファイル分)。隣接コードの模倣・SQL やコンフィグのコメントで自己文書化されている規約は CLAUDE.md に書いても挙動が変わらない
- 効果が出るのは「コードから発見できない運用ルール」(Preview DB 分離) と「新規ファイル作成時に参照すべき既存パターンが自明でないもの」(route handler の service 経由規約)

**プロセス上の改善点**:
- 調査サブエージェントの報告は一次ソース (実ファイル) で要点だけ再確認してから採用する。今回エイリアスの誤報告を実装直前に検出できた

### 次回への改善提案
- CLAUDE.md に新項目を足すときも同じあり/なし検証を通す (検証プローブの形式は design.md 参照)
- src/CLAUDE.md の 'use cache' 項目と supabase/CLAUDE.md の Preview 運用項目は未検証採用のため、効果が疑わしければ追加プローブで白黒つける
