# 要求内容

## 概要

Cursor Cloud Agent 向けの開発環境設定をリポジトリ管理にし、nested Docker + Supabase Local の起動と `.env.local` 生成を再現可能にする（Issue #333）。

## 背景

Cloud Agent 環境は個人スコープの override のみで、ブランチ/PR に追随しない。ネスト Docker のブリッジ通信や Node 24 前置、`lefthook` 競合回避など検証済みの手順がリポジトリ外に留まっている。

## 実装対象の機能

### 1. リポジトリ管理の Cloud Agent 環境
- `.cursor/environment.json` と install/start スクリプトをコミットする
- エージェント起動時に依存導入 → Docker/Supabase Local → `.env.local` 生成まで自動化する

### 2. Cloud 向け運用ドキュメント
- nested Docker のネットワーク修正、Node 24 PATH、`--ignore-scripts` の理由を文書化する
- `E2E_TEST_MODE` 付き e2e と `supabase start` の前提を文書化する

## 受け入れ条件

### リポジトリ管理の Cloud Agent 環境
- [ ] `.cursor/environment.json` がリポジトリに存在する
- [ ] install が `pnpm install --frozen-lockfile --ignore-scripts` + `pnpm rebuild` を実行する
- [ ] start が Docker 起動・FORWARD 修正・`supabase start`・`.env.local` 生成を行う
- [ ] start を再実行しても冪等である

### Cloud 向け運用ドキュメント
- [ ] `AGENTS.md` と `README.md` に Cloud Agent 向け手順が記載されている
- [ ] e2e 実行時の `E2E_TEST_MODE` / `.env.local` 読み込みが記載されている

## 成功指標

- 新規 Cloud Agent がブランチ上の設定だけで依存とローカル DB を起動できる
- Issue #333 の対応案チェックリストが満たされる

## スコープ外

- 個人ダッシュボード環境の Save（ユーザー操作が必要）
- カスタム Dockerfile によるベースイメージの全面再構築
- アプリ本体の機能変更

## 参照ドキュメント

- Issue #333
- `AGENTS.md`
- `docs/development-guidelines.md`
- `docs/repository-structure.md`
