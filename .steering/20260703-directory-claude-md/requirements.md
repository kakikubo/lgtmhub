# 要求内容

## 概要

AI (Claude Code) がコードを書き間違える・レビューで誤指摘する事項を、そのコードを触るときに必ず読まれる階層のディレクトリ別 CLAUDE.md に配置する。あわせて「作法の定義」が本体で docs/ と重複している doc 作成系 skill を削除する。

## 背景

- ルート CLAUDE.md は全セッションのコンテキストを消費するため、全域に効く事項だけを残したい
- プロジェクト固有規約 (レイヤールール、Supabase クライアント使い分け、Preview DB 運用など) は docs/ に埋もれており、該当コードを触るセッションで読まれない
- あり/なし検証 (Opus サブエージェント × 5 プローブ × 2 条件) で効果が確認できた項目だけを採用する方針で、配置設計は承認済み

## 実装対象

### 1. ディレクトリ分割 CLAUDE.md の配置 (PR 1)
- ルート CLAUDE.md の改訂 (検証コマンド・パスエイリアス・全域規約を追加、repository-structure.md と重複する構造説明を削除)
- app/api/CLAUDE.md 新規作成 (Route Handler 規約)
- src/CLAUDE.md 新規作成 (Supabase クライアント2種、AppError、db:types)
- supabase/CLAUDE.md 新規作成 (db:types、Preview migration 運用)
- docs/repository-structure.md のパスエイリアス記述を tsconfig.json の実態 (@/* → リポジトリルート) に修正

### 2. doc 作成系 skill の削除 (PR 2)
- .claude/architecture-design/, development-guidelines/, functional-design/, glossary-creation/, prd-writing/, repository-structure/ を削除 (内容は docs/*.md に実現済み)
- これらに依存する .claude/commands/setup-project.md も削除 (初期セットアップ完了済み)

## 受け入れ条件

### CLAUDE.md 配置
- [ ] 4 ファイル (ルート改訂 + 新規3つ) が承認済みドラフトどおりの内容で存在する
- [ ] 太字強調・Markdown 表を使っていない
- [ ] docs/repository-structure.md のエイリアス記述が tsconfig.json と一致する

### skill 削除
- [ ] 対象 6 ディレクトリと setup-project.md が削除されている
- [ ] steering / worktrees / add-feature / review-docs / agents は残っている
- [ ] 残存ファイルから削除対象への参照が壊れていない (CLAUDE.md ルートの /setup-project 言及は PR 1 の改訂で除去済み)

## スコープ外

- components/, tests/, docs/ への CLAUDE.md 配置 (検証で効果なしと判定)
- development-guidelines.md の Conventional Commits 規約と実コミット履歴の乖離解消 (別途判断)
- doc-reviewer / implementation-validator エージェントのスリム化 (任意改善として保留)

## 参照ドキュメント

- 本タスクの提案・検証結果: 会話ログ (2026-07-03)
- docs/repository-structure.md, docs/development-guidelines.md
