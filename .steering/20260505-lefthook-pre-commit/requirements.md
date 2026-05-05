# 要求書

## 背景

- Biome (`@biomejs/biome` v2.4.x) は導入済みで、`npm run lint` / `npm run format` / `npm run check` が利用可能。
- ただしコミット時の自動実行はされていないため、整形漏れや lint エラーがそのままコミット・プッシュされる懸念がある。
- 個人開発のためレビュアーは任意であり、コミットゲートで品質を担保する必要が高い。

参考: GitHub Issue [#21](https://github.com/kakikubo/lgtmhub/issues/21)

## ゴール

[lefthook](https://github.com/evilmartian/lefthook) を導入し、`git commit` 時にステージされたファイルに対して Biome の lint と format を自動実行する。

## 機能要件

### F1. lefthook の依存追加

- `lefthook` を `devDependencies` に追加する。
- `npm install` 後に `.git/hooks/pre-commit` 等が自動的に配置されるよう、`prepare` スクリプトを `package.json` に追加する。

### F2. lefthook 設定ファイルの作成

- リポジトリ直下に `lefthook.yml` を作成する。
- `pre-commit` フックを定義し、ステージ済みファイルに対して `biome check --write --no-errors-on-unmatched` を実行する。
- 実行対象は Biome がサポートする拡張子 (`*.{js,jsx,ts,tsx,json,jsonc,css}`) に限定する。
- 自動整形された結果が再ステージされ、コミットに含まれる挙動を持つ。
- Biome が lint エラーを検出した場合、コミットを失敗させる。

### F3. ドキュメント更新

- 導入手順と動作概要を `docs/development-guidelines.md`(フォーマット規約 / 開発環境セットアップ周辺) に追記する。
- 必要に応じて README にも参照を追記する(詳細はガイドラインを正とする)。

## 受け入れ条件

- [ ] `npm install` 直後に `.git/hooks/pre-commit` が lefthook 経由で配置される(中身に lefthook の文字列が含まれる)。
- [ ] 整形が必要なファイルをステージしてコミットすると、自動整形された内容でコミットされる。
- [ ] Biome が lint エラーを検出した場合、コミットが失敗する。
- [ ] CI (`.github/workflows/ci.yml`) で実行される Biome チェックと挙動が矛盾しない(CI は `npm run lint` を実行しエラー検出時に fail、lefthook は `biome check --write` を実行しエラー検出時に fail で意味は同じ)。

## 非機能要件

### NFR1. パフォーマンス

- pre-commit 実行時間は、典型的な変更ファイル(数ファイル)で 1 秒以内を目標とする(Biome は Rust 実装で 50ms 程度のため十分達成可能)。

### NFR2. 開発者体験

- `git commit --no-verify` 等の hook バイパスは禁止しないが、ガイドライン上は通常運用では使わないことを明記する。
- フック未インストール状態でも `git commit` は失敗しない(lefthook 未導入の clone 直後と同等)。

### NFR3. CI との整合

- CI 側の `lint-and-typecheck` ジョブの挙動は変更しない。lefthook はあくまでローカル防衛線として位置付ける。

## スコープ外

- `pre-push` フックは今回は導入しない(必要であれば別 issue)。
- `commit-msg` フックによるコミットメッセージ検証は今回は導入しない。
- `typecheck` を pre-commit で実行することは行わない(コミット粒度ごとの差分では型推論が部分的になりやすく、CI で担保する方が確実)。
- ステージ外ファイルの自動整形は行わない(lefthook の `{staged_files}` 指定で staged のみを対象とする)。
