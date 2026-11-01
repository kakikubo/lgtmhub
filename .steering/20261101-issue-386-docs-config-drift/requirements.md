# 要求: docs に転記された依存バージョン・CI 設定の乖離を解消する (Issue #386)

## 背景

docs に `package.json` / `ci.yml` の全文コピーがあり、Renovate による更新に追従できず実態とずれている。

## 要求

1. `docs/architecture.md`「バージョン管理方針」の `package.json` 全文コピーをやめ、`package.json` へのリンクと方針の要点だけにする
2. `docs/development-guidelines.md` の `ci.yml` 全文コピーをやめ、`ci.yml` へのリンクとジョブ構成の要点だけにする
3. 残す抜粋は実態に合わせる
   - Codecov の action バージョン (`@v5` → 固定表記をやめる)
   - Codecov 計測範囲に `components/**` を含める
   - `package.json scripts` の `test:integration` に `--passWithNoTests`（scripts も全文コピーをやめリンク化する）
   - `.github/workflows/danger.yml` のコメント `dangerfile.ts` → `dangerfile.js`
4. バージョン表 (CLAUDE.md / architecture.md / development-guidelines.md / glossary.md) の TypeScript 6.x 等の古い表記を実態に合わせる

## 受け入れ条件

- docs 内に `~16.2.0` / `~6.0.3` / `^0.34.0` / `checkout@v4` / `codecov-action@v5` 等の古い転記が残っていない
- `pnpm run lint:md` / `pnpm run check` / `pnpm run typecheck` / `pnpm run test` が通る

## スコープ外

- 設定ファイル自体の変更（danger.yml のコメント修正を除く）
