# 設計: Renovate 導入

## 採用アーキテクチャ

**Mend Renovate App（GitHub App 版）+ リポジトリ内 `renovate.json`** を採用する。

- 採用理由:
  - Self-hosted Action は CI 上で `renovate` を起動するため GitHub Actions の minutes / トークン管理が増える。OSS かつ低トラフィックな本リポジトリでは GitHub App 版（無料）で十分
  - GitHub App 版はオンボーディング PR を自動作成するため、初期チューニングが楽
- 設定ファイルの配置: リポジトリルート `renovate.json`（Renovate のデフォルト探索先で extension`.json5` でなくとも問題ない。コメントは不要なため `.json` を選択）

## 設計上の判断

### スケジュール

- `schedule: ["before 9am on monday"]` を `extends` を介して全体適用する
- 月曜の朝にまとめて PR が立つ運用にすることで、レビュー効率が高い
- セキュリティアップデート（`vulnerabilityAlerts`）は **schedule を無視して即時** PR を作る（Renovate のデフォルト動作。明示的に `vulnerabilityAlerts.enabled: true` を設定する）

### Semantic Commits + Dependency Dashboard

- `:semanticCommits` プリセットでコミット/PR タイトルを `chore(deps): ...` に統一する
- `:dependencyDashboard` プリセットで Dependency Dashboard issue を有効化する
  - Issue タイトル: `Dependency Dashboard`
  - 1 issue にすべての pending update / open PR がリストされる

### グルーピング戦略 (`packageRules`)

更新の粒度を「同時に上げないと型が壊れるグループ」と「単独で上げて良いグループ」で分ける。

| グループ名 | 対象パッケージ | 理由 |
|-----------|---------------|------|
| `react` | `react`, `react-dom`, `@types/react`, `@types/react-dom` | React 本体と型定義を分離して上げると型エラーになる |
| `next` | `next`, `@next/*`, `eslint-config-next`(将来) | Next.js は内部 API がメジャー間で破壊的変更しがち |
| `supabase` | `@supabase/*`, `supabase`(CLI) | クライアント / SSR / CLI の整合性 |
| `biome` | `@biomejs/*` | フォーマッタとプラグインのバージョン同期 |
| `vitest` | `vitest`, `@vitest/*`, `vite-tsconfig-paths` | Vitest コアとプラグイン |
| `playwright` | `@playwright/*` (`@playwright/test` 等) | Playwright モジュール群 |
| `tailwind` | `tailwindcss`, `@tailwindcss/*`, `tw-animate-css` | Tailwind v4 と PostCSS プラグインの整合性 |
| `types` | `@types/*` (上記グループ以外) | 型定義のみのまとめ |

### 自動マージ方針

- **minor / patch**: `automerge: true`、`automergeType: "pr"`、`platformAutomerge: true`
  - GitHub の auto-merge 機能を使い、CI 通過後に Renovate が手を出さずにマージ
  - リポジトリ設定で `Allow auto-merge` を有効化する必要あり（README/development-guidelines に手順を追記）
- **major**: `automerge: false`（手動レビュー必須）。Dependency Dashboard 経由で確認する
- **lockFileMaintenance**: 週次で `package-lock.json` を更新、`automerge: true`
- **GitHub Actions（`actions/checkout` 等）の digest 更新**: `automerge: true`。SHA pinning は本リポジトリではタグ参照（`@v4` など）のみのため、`pinDigests` は無効のまま
- **vulnerability alerts**: `automerge: false`（パッチ内容を必ず人間が確認したい）

### Manager の有効化

- `npm` (default): `package.json` / `package-lock.json`
- `github-actions` (default): `.github/workflows/*.yml`
- `dockerfile` (default): なし（リポジトリに Dockerfile を持たないため有効化しても影響なし）
- `devcontainer` (default): `.devcontainer/devcontainer.json` の `image` フィールド（`mcr.microsoft.com/devcontainers/typescript-node:1-24`）
- `nvm` / `node` の `engines` 同期: `node` の major は固定（`>=24.0.0`）。ピンの更新は `packageRules` で `matchDepNames: ["node"]` を `enabled: false` にして無効化（major アップデートは手動）

### Node.js バージョン同期

- `package.json` の `engines.node`、`.github/workflows/*.yml` の `actions/setup-node@... node-version`、`.devcontainer/devcontainer.json` の base image (`typescript-node:1-24`) を同期したい
- Renovate は各 manager が独立して PR を作るため、Node の major アップデートは Dependency Dashboard で意識的にまとめてマージする運用にする
- 当面は `node` の major アップデートを `enabled: false` で抑止し、majorは手動オペレーションで Dashboard 経由で対応する

### Issue で要求されている将来検討（pnpm 移行）

- PR #17 がマージされた際に `packageManager` フィールドが入ったとしても、Renovate は `packageManager` の更新もネイティブサポート済み。本 `renovate.json` は変更不要
- ただし lockfile が `pnpm-lock.yaml` に切り替わるため、`lockFileMaintenance` が pnpm に追従できるかは PR #17 マージ後に確認する（メモを `tasklist.md` の申し送りに残す）

## renovate.json の最終形（要点）

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    ":dependencyDashboard",
    ":timezone(Asia/Tokyo)"
  ],
  "schedule": ["before 9am on monday"],
  "lockFileMaintenance": {
    "enabled": true,
    "automerge": true,
    "schedule": ["before 9am on monday"]
  },
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security"],
    "automerge": false
  },
  "packageRules": [
    { "matchUpdateTypes": ["minor", "patch", "pin", "digest"], "automerge": true, "platformAutomerge": true },
    { "matchUpdateTypes": ["major"], "automerge": false, "labels": ["dependencies", "major"] },
    { "groupName": "react", "matchPackageNames": ["react", "react-dom", "@types/react", "@types/react-dom"] },
    { "groupName": "next", "matchPackageNames": ["next", "eslint-config-next", "@next/**"] },
    { "groupName": "supabase", "matchPackageNames": ["supabase", "@supabase/**"] },
    { "groupName": "biome", "matchPackageNames": ["@biomejs/**"] },
    { "groupName": "vitest", "matchPackageNames": ["vitest", "vite-tsconfig-paths", "@vitest/**"] },
    { "groupName": "playwright", "matchPackageNames": ["@playwright/**"] },
    { "groupName": "tailwind", "matchPackageNames": ["tailwindcss", "tw-animate-css", "@tailwindcss/**"] },
    { "groupName": "types", "matchPackageNames": ["@types/**", "!@types/react", "!@types/react-dom"] },
    { "matchDepTypes": ["engines"], "matchDepNames": ["node"], "enabled": false },
    { "matchManagers": ["github-actions"], "groupName": "github-actions", "automerge": true, "platformAutomerge": true }
  ]
}
```

> NOTE: Renovate v37 以降は `matchPackagePrefixes` / `excludePackageNames` が deprecated。代わりに `matchPackageNames` に glob (`@supabase/**`) と `!`-prefix 否定 (`!@types/react`) を組み合わせる。`renovate-config-validator` で妥当性を確認する。

## ドキュメント更新

`docs/development-guidelines.md` の「依存関係管理」相当セクションに以下を追記:

- Renovate App が稼働しており、月曜午前に PR が作成される旨
- minor / patch + GitHub Actions digest は自動マージされる（CI 通過時）
- major および vulnerability alerts は Dependency Dashboard で手動レビューする
- 設定変更は `renovate.json` を直接編集する（PR ベース）

## 検証戦略

- `renovate.json` は静的設定ファイルのため、`npm test` / `lint` / `typecheck` の対象外。
  - lint / typecheck の実行で **regression がないこと** を確認するに留める
- 設定の妥当性は Renovate 公式の `npx --package renovate -- renovate-config-validator` で検証可能。CI には組み込まないが、初回のローカル検証で実行する
- Renovate App の有効化後、Onboarding PR が作成されることを実環境で確認するのは Issue 完了の検収条件として残す（このタスクスコープ外、`docs` で運用手順として残す）
