# 要求内容: Renovate を導入して依存関係の自動更新を行う

参照: [Issue #33](https://github.com/kakikubo/lgtmhub/issues/33)

## 背景

現状、依存パッケージ（`package.json` / GitHub Actions / devcontainer など）の更新は手動で行っており、以下の課題がある。

- セキュリティパッチの追従漏れ（`npm audit --audit-level=high` を CI で回しているが、修正 PR は手作業）
- マイナー / パッチアップデートの取りこぼし（Next.js, React, Supabase, Biome, Vitest, Playwright など更新頻度が高い）
- GitHub Actions の SHA / バージョン固定の更新が止まりがち

## ゴール

Renovate を導入し、依存関係の更新 PR が自動で作成・整理される状態にする。

## 受け入れ条件

- [ ] Renovate がリポジトリで稼働し、初回の Onboarding PR が作成される
- [ ] `npm outdated` で出てくる更新可能な依存に対し、Renovate が PR を作成している
- [ ] GitHub Actions（`actions/checkout`, `actions/setup-node`, `supabase/setup-cli` 等）の更新 PR も作成される
- [ ] 自動マージ対象（minor / patch）の PR が CI 通過後にマージされる
- [ ] Dependency Dashboard issue が作成され、保留中の更新が一覧できる

## やりたいこと

- Mend Renovate App を `kakikubo/lgtmhub` に有効化する（外部設定 = 本タスクのスコープ外、ドキュメントで案内）
- リポジトリに `renovate.json` を追加し、本プロジェクトに合った更新方針を反映する
- Dependency Dashboard を有効化する
- 運用ポリシーを `docs/development-guidelines.md` に追記する

## renovate.json に反映する方針

- `extends`: `config:recommended`、`:semanticCommits`、`:dependencyDashboard`
- スケジュール: `before 9am on monday`（PR 集中砲火を避けるため週 1）
- `packageRules` で同種パッケージをグループ化
  - React 系（`react`, `react-dom`, `@types/react*`）
  - Next.js 系（`next`, `eslint-config-next`）
  - Supabase 系（`@supabase/*`, `supabase` CLI）
  - Biome（`@biomejs/*`）
  - Vitest（`vitest`, `@vitest/*`）
  - Playwright（`@playwright/*`）
  - Tailwind（`tailwindcss`, `@tailwindcss/*`, `tw-animate-css`）
- `lockFileMaintenance` を週次 enable
- minor / patch は CI green 条件で `automerge: true`、major は手動レビュー必須
- `github-actions` manager を有効化
- `dockerfile` / `devcontainer` manager（base image）を有効化
- Node.js のバージョン更新（`engines.node` / `actions/setup-node` の `node-version`）を同期

## 制約・前提

- 本リポジトリは npm 利用（`packageManager` フィールドはまだ設定していないため lockfile は `package-lock.json` のみ）
- Issue で言及されている PR #17（pnpm 移行）はまだマージされていない前提。Renovate は npm 構成を起点にする
- Mend Renovate App の有効化はリポジトリ管理者が GitHub UI で実施する（Claude のスコープ外）
- 自動マージは Renovate Bot が GitHub の merge を呼ぶため、`Allow auto-merge` をリポジトリ設定で有効化する必要がある（手順をドキュメント化する）

## 非対象

- pnpm 化など、`packageManager` フィールド側の整理（PR #17 で別途実施）
- Renovate Self-hosted Action 化（GitHub App 版を採用するためスコープ外）
- 各 `packageRules` 配下の細かいバージョン pin / ignore 戦略（運用しながら個別調整）
