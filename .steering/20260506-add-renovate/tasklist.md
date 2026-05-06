# タスクリスト: Renovate を導入して依存関係の自動更新を行う

## 実装タスク

- [x] T1. リポジトリルートに `renovate.json` を作成し、`design.md` の最終形をベースに以下を反映
  - [x] `extends`: `config:recommended` / `:semanticCommits` / `:dependencyDashboard` / `:timezone(Asia/Tokyo)`
  - [x] 全体スケジュール: `before 9am on monday`
  - [x] `lockFileMaintenance` 週次有効・automerge true
  - [x] `vulnerabilityAlerts` 有効・automerge false・`labels: ["security"]`
  - [x] `packageRules`:
    - [x] minor/patch/digest/pin は automerge true (platformAutomerge true)
    - [x] major は automerge false、`labels: ["dependencies", "major"]`
    - [x] グループ化: react / next / supabase / biome / vitest / playwright / tailwind / types
    - [x] `engines.node` の更新は無効化 (手動運用)
    - [x] github-actions manager をグループ化し automerge true
- [x] T2. `renovate.json` を `npx --package renovate -- renovate-config-validator` で検証
- [x] T3. `docs/development-guidelines.md` の「依存関係管理」近傍に Renovate 運用ポリシーを追記
  - [x] Renovate が月曜午前に PR を出す旨
  - [x] minor/patch/GitHub Actions digest は CI 通過後に auto-merge される
  - [x] major / vulnerability alerts は Dependency Dashboard で手動レビュー
  - [x] リポジトリで `Allow auto-merge` を有効化する手順
  - [x] Mend Renovate App を `kakikubo/lgtmhub` に有効化する手順 (GitHub UI)
  - [x] (追加) `docs/architecture.md` の Dependabot 言及を Renovate に修正

## 検証タスク

- [x] V1. `npm run lint` を実行し pass を確認 (Biome: 71 files checked, no errors)
- [x] V2. `npm run typecheck` を実行し pass を確認 (`tsc --noEmit` exit 0)
- [x] V3. `npm test` を実行し pass を確認 (150 tests passed)
- [x] V4. `npx --yes --package renovate -- renovate-config-validator` で `renovate.json` の妥当性を確認 (Config validated successfully)
- [x] V5. `implementation-validator` サブエージェントでコード品質を検証 (3.5/5。指摘 3 件 (`eslint-config-next` 追加 / `github-actions` ルールの `platformAutomerge` / `devcontainer` の運用記載) を反映)

## 申し送り (振り返り)

### 実装完了日

2026-05-06

### 計画と実績の差分

- 計画通り: `renovate.json` 新規作成、`docs/development-guidelines.md` への運用ポリシー追記、`docs/architecture.md` の Dependabot 言及修正は設計どおり完了
- 追加実装: `implementation-validator` サブエージェントの指摘を受けて 3 件を取り込んだ
  - `next` グループに `eslint-config-next` を追加 (将来の ESLint 導入に備える)
  - `github-actions` グループに `platformAutomerge: true` を追加 (minor/patch ルールと自動マージ方式を統一)
  - `devcontainer` manager の運用ポリシーを `development-guidelines.md` のグルーピング表に追記
- 設計修正: `design.md` の `renovate.json` サンプルが `matchPackagePrefixes` / `excludePackageNames` という deprecated 構文だったため、Renovate v37+ 推奨の `matchPackageNames` glob + `!`-prefix 否定構文に更新 (実装と設計のドリフトを解消)

### 学んだこと

- Renovate v37+ は `matchPackagePrefixes` / `matchPackagePatterns` / `excludePackageNames` を deprecated 化し、`matchPackageNames` に glob (`@foo/**`) と否定 (`!@foo/bar`) を集約した。古いネット記事や設計サンプルとの齟齬に注意
- `lockFileMaintenance.schedule` を明示しなくてもトップレベル `schedule` が継承される (今回は意図を明示するため二重指定で残した)
- `vulnerabilityAlerts` はトップレベル `schedule` を無視して即時 PR を作成する (`automerge: false` にすることで人間レビューを必須化)
- `engines.node` の更新はあえて Renovate 対象外 (`enabled: false`) にし、devcontainer base image / `actions/setup-node` / `package.json` engines を **手動で同時更新** する運用を選択
- 検証フローとして `npx --yes --package renovate -- renovate-config-validator renovate.json` をローカルで使うと設定ミスを早期に検知できる
- `npm run lint` を rtk 経由で実行すると Biome の出力を ESLint JSON として誤パースする (`rtk proxy npm run lint` で回避)。手元のラッパー設定に依存する事象なので CI では問題なし

### 次回への改善提案

- Mend Renovate App を `kakikubo/lgtmhub` に有効化する作業はリポジトリ管理者が GitHub UI で行う必要がある (本 PR スコープ外)。マージ後に Onboarding PR が立つことを確認する
- `Settings > General > Pull Requests > Allow auto-merge` の有効化も同タイミングで実施。これがないと `automerge: true` の設定が無視される
- 初回 Onboarding PR を 1〜2 週間運用してみて、グルーピングや schedule に過不足があれば `renovate.json` を追従させる
- pnpm 移行 PR (#17) がマージされた際に `lockFileMaintenance` が `pnpm-lock.yaml` を扱えることを確認する (Renovate は対応済みだが lockfile 形式変更時の挙動を観察)
- Node.js メジャーアップデート (例: 24 → 25) のタイミングで、`engines.node` 手動同期手順を `docs/development-guidelines.md` の「依存関係管理 (Renovate)」セクションに具体例として追記する余地あり
