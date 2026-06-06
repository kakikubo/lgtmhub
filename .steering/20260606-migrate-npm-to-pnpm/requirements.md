# 要求内容: npm から pnpm へのパッケージマネージャ移行

関連 Issue: https://github.com/kakikubo/lgtmhub/issues/17

## 背景

現状は npm を使用しているが、pnpm に移行することで以下のメリットを得たい。

- インストールの高速化
- ディスク使用量の削減（content-addressable storage）
- 厳格な依存解決による phantom dependency の排除

## ゴール

パッケージマネージャを npm から pnpm に切り替え、ローカル・CI・本番ビルド（Vercel）の全環境で
`install` → `lint` / `typecheck` / `test` / `build` が成立する状態にする。

## 受け入れ条件

- [ ] `package-lock.json` を削除し `pnpm-lock.yaml` を生成
- [ ] `package.json` に `packageManager` フィールド（Corepack 対応）を追加
- [ ] pnpm 用設定（`.npmrc` / 必要なら build-script 許可設定）を追加
- [ ] CI（GitHub Actions）を pnpm 利用に書き換え（`pnpm/action-setup` 導入）
- [ ] devcontainer の npm 利用箇所を pnpm に置換
- [ ] Vercel 本番ビルドが pnpm で成立する（lockfile + packageManager による自動検出）
- [ ] `README.md` / `CLAUDE.md` / `docs/` の npm 表記を pnpm に書き換え
- [ ] phantom dependency が発覚した場合は `package.json` に明示的に追加
- [ ] ローカルで `pnpm install` → `pnpm run lint` / `pnpm run typecheck` / `pnpm test` / `pnpm run build` がすべて通る

## スコープ外（今回やらないこと）

- push / PR 作成 / Vercel への実デプロイ（外向き操作はユーザー判断に委ねる）
- 依存パッケージのバージョンアップ（移行のみに専念）

## 環境前提

- pnpm 10.4.1 / corepack 0.34.0 がローカルにインストール済み
- Node.js v24 系
