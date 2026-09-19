# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

---

## フェーズ1: Cloud Agent 設定のリポジトリ化

- [x] `.cursor/install.sh` を追加する
- [x] `.cursor/start.sh` を追加する（nested Docker 修正 + supabase + .env.local）
- [x] `.cursor/environment.json` を追加する

## フェーズ2: ドキュメント

- [x] `AGENTS.md` の Cursor Cloud 節を拡充する
- [x] `README.md` に Cursor Cloud Agent 節を追加する
- [x] `docs/repository-structure.md` に `.cursor/` を追記する

## フェーズ3: 検証

- [x] `bash .cursor/install.sh` を 2 回実行して冪等を確認
- [x] `bash .cursor/start.sh` 後に Supabase / `.env.local` を確認
- [x] `pnpm run check` / `typecheck` / `test` を実行
  - `typecheck` / `test` (419) は成功
  - `check` は main 既存の format 差分（`compose-lgtm.test.ts`、Issue #306 / PR #335）で失敗。本 PR 範囲外

## フェーズ4: PR

- [x] コミット・push・PR 作成（Closes #333）
- [x] 実装後の振り返りを記録

---

## 実装後の振り返り

### 実装完了日
2026-09-19

### 計画と実績の差分

**計画と異なった点**:
- 個人ダッシュボードの Save はユーザー操作のため PR スコープ外とし、リポジトリの `.cursor/environment.json` 恒久化に集中した
- `pnpm run check` は既存の biome format 差分で失敗するため、本 issue ではゲートに含めず typecheck / unit で健全性を確認した

**新たに必要になったタスク**:
- なし

### 学んだこと

**技術的な学び**:
- Cloud Agent では `prepare`（lefthook）が `core.hooksPath` と衝突するため install は `--ignore-scripts` + `rebuild` が必須
- ネスト Docker では nft / legacy 両方の FORWARD と bridge-nf 無効化がコンテナ間通信の前提

**プロセス上の改善点**:
- 検証済みの `~/.cloud-env/start.sh` をそのままリポジトリ化し、ドキュメントとセットで追えるようにした

### 次回への改善提案
- merge 後に新規 Cloud Agent で install/start が自動実行されることを一度確認する
- 必要なら `.cursor/Dockerfile` で Node 24 + Docker をベースイメージ側に固定する
