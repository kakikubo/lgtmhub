# 設計書

## アーキテクチャ概要

品質ゲートを「lint のみ」から「lint + format」に揃える。ローカル検証コマンド（`pnpm run check`）・CI・ドキュメントの三者を同一にする。lefthook は staged ファイルの自動整形という役割を維持し、リポジトリ全体のドリフト検出は CI が担う。

```
開発者ローカル                 Git commit                    GitHub Actions
─────────────                 ──────────                    ──────────────
pnpm run check                lefthook pre-commit           lint-and-typecheck
 = biome check .               = biome check --write         = pnpm run check
   lint + format                 staged files only             = biome check .
                                 (自動整形して再ステージ)         lint + format
                                                              ※ --write なし
```

## コンポーネント設計

### 1. 既存ファイルの整形

**責務**:
- 現行 Biome（lockfile 解決結果 2.5.13）が検出する format 差分を解消する

**実装の要点**:
- 対象は `tests/unit/lib/image/compose-lgtm.test.ts` の `it.each` コールバック引数の折り返し 1 箇所
- `pnpm run format`（`biome format --write .`）で機械的に適用する。手で整形しない
- テストロジックは変更しない

### 2. CI ワークフロー

**責務**:
- PR / `main` push で lint と format の両方をゲートする

**実装の要点**:
- `.github/workflows/ci.yml` の `lint-and-typecheck` ジョブで `pnpm run lint` を `pnpm run check` に置き換える
- ジョブ名は lint を含むが typecheck とセットの識別子として維持する（リネームは Renovate / バッジ等のノイズになるため不要）
- `biome check` は `--write` なしなので CI 上でファイルを書き換えない。差分があれば非 0 終了する
- `pnpm run lint` スクリプト自体は残す（部分実行やローカルの lint のみ確認に使う）

### 3. `biome.json` のマイグレーション

**責務**:
- CLI と設定スキーマのバージョン不一致、deprecated オプションを解消する

**実装の要点**:
- `pnpm exec biome migrate --write` を実行する。手動でキーを書き換えない
- 期待する差分:
  - `$schema`: `2.4.14` → 現行 CLI バージョン（2.5.13）
  - `linter.rules.recommended: true` → `linter.rules.preset: "recommended"`
- `preset: "none"` に落ちていないことを目視確認する（Biome 2.5 初期の migrate バグの残渣。2.5.2 以降で修正済みだが、`recommended` が単一キーのインラインオブジェクトだと再発しうる）
- 既存の個別上書き（`style.noNonNullAssertion: "off"`、tests override 等）は維持する

### 4. ドキュメント

**責務**:
- CI が format を検査するという実態をガイドラインに反映する

**実装の要点**:
- 正典は `docs/development-guidelines.md`
- 更新箇所:
  - Biome のローカル検証を `pnpm run check` に揃える
  - CI が `pnpm run check` を実行すると書く
  - lefthook 節の「CI 側は format チェックを行わない」を削除し、staged 漏れは CI が拾うと書く
  - サンプル YAML の `pnpm run lint` を `pnpm run check` に変える（サンプルは ci.yml を正とする注記は維持）
  - PR チェックリストの lint 項目を `pnpm run check` に変える
  - `linter.rules.recommended` の記述を `preset` に合わせる
- `docs/architecture.md` / `docs/repository-structure.md` は Biome の役割・除外パスのみで、CI コマンドを述べていないため変更しない
- CLAUDE.md は既に `pnpm run check` を挙げているため変更しない

## データフロー

### format 差分のあるコミットが CI で落ちる
```
1. 開発者が format されていないファイルを push する
2. GitHub Actions の lint-and-typecheck が pnpm run check を実行する
3. biome check が Formatter would have printed... を error として報告し非 0 終了する
4. PR はマージできない
```

### Biome のマイナー更新で format ルールが変わった場合
```
1. Renovate が @biomejs/biome を caret range 内で更新する
2. 既存ファイルに format 差分が出ると、同じ PR の CI が pnpm run check で失敗する
3. その PR で format を適用するか、別途整形コミットを足す
```

## エラーハンドリング戦略

本変更にアプリの実行時エラー処理は無い。品質ゲートの失敗は次のとおり:

- format 差分: `biome check` が error を出し exit 1。`--write` は CI では使わない
- deserialize info: マイグレーション後は出さない。info は現状 exit 1 の原因ではないが、ノイズになるため解消する

## テスト戦略

### ユニットテスト
- テストコードのロジックは変えない。整形のみなので新規テストは不要
- 整形後に `pnpm run test` で既存テストが通ることを確認する（compose-lgtm.test.ts を含む）

### ゲートの確認
- `pnpm run check` が exit 0、deserialize info 0 件
- `pnpm run lint` が exit 0（スクリプト残置の回帰確認）
- CI の format ゲートは、意図的に崩したコミットを積まない。レビューで `ci.yml` のステップ置換を担保する

## 依存ライブラリ

追加なし。既存の `@biomejs/biome`（`^2.4.14`、lockfile 解決 2.5.13）を使う。

## ディレクトリ構造

```
.github/workflows/ci.yml
biome.json
tests/unit/lib/image/compose-lgtm.test.ts
docs/development-guidelines.md
.steering/20260919-issue-306-biome-check-ci/
```

## 実装の順序

1. `biome format --write` で既存 format 差分を解消する
2. `biome migrate --write` で `biome.json` を追随させ、`preset: "recommended"` を確認する
3. CI を `pnpm run check` に切り替える
4. `docs/development-guidelines.md` を更新する
5. `pnpm run check` / `lint` / `typecheck` / `test` を通す

## セキュリティ考慮事項

- CI で `--write` しない。ワークスペースを書き換えない検査専用にする

## パフォーマンス考慮事項

- `biome check .` は現状 100 ファイル強で数十 ms。`biome lint .` からの増加は無視できる
- lefthook を全ファイル検査にしない（コミット時の待ちを増やさない）

## 将来の拡張性

- 必要なら `check` スクリプトを `biome ci .` に差し替えられる。今回は `pnpm run check` と CLAUDE.md を一致させることを優先する
- Biome のメジャーアップ時は再度 `biome migrate` を走らせる
