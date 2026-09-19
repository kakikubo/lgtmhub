# 要求内容

## 概要

`pnpm run check` が `main` で失敗する状態を解消し、CI が Biome の lint だけでなく format もゲートするようにする。あわせて `biome.json` を現行 CLI バージョンへ追随させる。

## 背景

`CLAUDE.md` が検証コマンドとして挙げている `pnpm run check`（`biome check .` = lint + format）が、`main` 時点で format 差分 1 件により exit 1 になる。

原因は format 差分が検出されずに `main` へ入る経路が2つあること:

1. CI の `lint-and-typecheck` ジョブが実行するのは `pnpm run lint`（`biome lint .`）のみで、format を検査しない
2. lefthook の `pre-commit` は staged ファイルに対してのみ `biome check` を実行するため、Biome のバージョン更新に伴う既存ファイルの format ドリフトを検出しない

影響:

- 開発者が `pnpm run check` を実行すると、自分の変更とは無関係なエラーで失敗する
- format ルールが実質的に強制されていないため、今後も差分が蓄積しうる

参照: GitHub Issue [#306](https://github.com/kakikubo/lgtmhub/issues/306)

## 実装対象の機能

### 1. 既存の format 差分を解消する
- `tests/unit/lib/image/compose-lgtm.test.ts` を現行 Biome の整形結果に合わせる
- `pnpm run check` が exit 0 で終わる状態にする

### 2. CI で format をゲートする
- `.github/workflows/ci.yml` の `lint-and-typecheck` ジョブで `pnpm run check` を実行する
- lint のみでは見逃していた format 差分のあるコミットを CI で落とす

### 3. `biome.json` を CLI バージョンへ追随させる
- `$schema` を現行 CLI（lockfile 解決結果）に合わせる
- deprecated の `linter.rules.recommended` を `linter.rules.preset` に置き換える
- deserialize info が出ない状態にする

### 4. ガイドラインを実態に合わせる
- `docs/development-guidelines.md` の「CI は `pnpm run lint` のみ」という記述を更新する

## 受け入れ条件

### 既存の format 差分を解消する
- [ ] `pnpm run check` が exit 0 で終わる
- [ ] `pnpm run lint` も引き続き exit 0 で終わる

### CI で format をゲートする
- [ ] `.github/workflows/ci.yml` の `lint-and-typecheck` が `pnpm run check` を実行する
- [ ] format 差分のあるファイルがあると CI の当該ジョブが失敗する（レビューで担保）

### `biome.json` を CLI バージョンへ追随させる
- [ ] `$schema` がインストール済み Biome CLI のバージョンと一致する
- [ ] `linter.rules.preset` が `"recommended"` であり、既存の個別ルール上書きを維持する
- [ ] `pnpm run check` が deserialize info を出さない

### ガイドラインを実態に合わせる
- [ ] `docs/development-guidelines.md` が CI で format も検査することを述べている

## 成功指標

- `main` 相当の作業コピーで `pnpm run check` が通る
- 以後、format ドリフトは CI で検出され `main` に入らない

## スコープ外

以下はこのフェーズでは実装しません:

- lefthook を全ファイル検査に変更すること（staged のみはコミット時の速度のため維持。リポジトリ全体のドリフトは CI が担う）
- `@biomejs/biome` の specifier をピン留めすること（caret range は維持。更新時の format 差分は CI が落とす）
- `biome ci` コマンドへの切り替え（`pnpm run check` で十分。CLAUDE.md の検証コマンドとも一致する）

## 参照ドキュメント

- `docs/development-guidelines.md` - 開発ガイドライン（Biome / CI / lefthook）
- `docs/architecture.md` - 開発ツールとしての Biome
- `docs/repository-structure.md` - `biome.json` の除外設定
- GitHub Issue [#306](https://github.com/kakikubo/lgtmhub/issues/306)
