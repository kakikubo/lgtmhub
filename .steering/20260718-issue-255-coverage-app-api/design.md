# 設計書

## アーキテクチャ概要

カバレッジの責務分担は Codecov 導入時に確立済みで、本作業でも変更しない。

| 層 | 責務 | 実体 |
|---|---|---|
| 計測 | どのファイルを測るか | `vitest.config.ts` の `coverage.include` / `exclude` ← **今回の変更対象** |
| ゲート | 閾値未達で CI を落とす | `vitest.config.ts` の `coverage.thresholds` (`src/**` のみ) ← 不変 |
| 可視化 | PR コメント・時系列・バッジ | `codecov.yml` (`informational: true`) ← 不変 |

今回触るのは**計測層のみ**。ゲートと可視化の設定には一切手を入れない。

## コンポーネント設計

### 1. `vitest.config.ts`

```diff
-      include: ['src/**/*.ts', 'src/**/*.tsx'],
+      include: ['src/**/*.ts', 'src/**/*.tsx', 'app/api/**/*.ts'],
```

- `app/api/**` は `route.ts` のみで `.tsx` は存在しないため、パターンは `*.ts` に限定する
- `exclude` は `['src/types/**', 'src/**/*.test.ts']` のまま。`app/api` 配下にテストファイルは無い（テストは `tests/unit/api/` に分離されている）
- `thresholds` の glob は `src/services/**` と `src/lib/**` のみ。グローバル閾値は未設定のため、`app/api/**` はどの閾値にもマッチせず**ゲート対象にならない**（意図的）

### 2. `codecov.yml`

**変更なし。** 現在の `ignore` は以下の 3 パターンで、いずれも `app/` を弾かない。

```yaml
ignore:
  - "src/types/**"
  - "tests/**"
  - "**/*.test.ts"
```

lcov に `app/api` の行が含まれれば、Codecov 側は自動的に集計対象に含める。

### 3. `docs/development-guidelines.md`

- 「カバレッジ目標」節の `coverage` スニペットに `include` の実体を反映
- 「Codecov > 集計対象」の記述に、計測範囲が `src/**` + `app/api/**` であること、および `app/(site)/**` を含めていない理由（e2e カバレッジ未収集）を追記

## データフロー

### カバレッジが Codecov に届くまで

1. CI の `test` ジョブが `pnpm run test:coverage` を実行
2. v8 provider が `include` にマッチしたファイルを計測。**マッチした未テストファイルも 0% として集計される**
3. `lcov` レポーターが `coverage/lcov.info` を生成（`SF:` 行に repo root 相対パス）
4. `codecov/codecov-action@v7` が `./coverage/lcov.info` をアップロード
5. Codecov が `ignore` を適用して集計し、PR コメント・バッジに反映

手順 2 の「マッチした未テストファイルも 0% になる」性質が、`app/(site)/**` をスコープ外にした根拠。

## テスト戦略

本変更はビルド設定のみでプロダクションコードを含まないため、新規テストは追加しない。検証は既存テストスイートの実行結果と、生成される lcov の内容で行う。

### 検証手順

1. `pnpm run test:coverage` → 全テスト pass、既存 thresholds 通過
2. `grep '^SF:' coverage/lcov.info | grep app` → 6 route すべてが出力される
3. `pnpm run check` / `pnpm run typecheck` → exit 0
4. PR 上で CI グリーン + Codecov コメントに `app/api` が現れる

## 依存ライブラリ

追加・更新なし。`@vitest/coverage-v8` は既に devDependencies に存在する。

## ディレクトリ構造

変更なし。

## 実装の順序

1. `vitest.config.ts` の `coverage.include` を変更
2. ローカルで `test:coverage` / `check` / `typecheck` を実行し検証
3. `docs/development-guidelines.md` の 2 箇所を同期
4. コミット・push・PR 作成
5. CI と Codecov PR コメントで最終確認

## セキュリティ考慮事項

なし。計測範囲の変更のみで、シークレットや権限には影響しない。

## パフォーマンス考慮事項

計測対象が 6 ファイル増えるが、実行するテスト自体は変わらない（`test.include` は不変）。CI 時間への影響は無視できる。

## 将来の拡張性

以下は本作業の完了後、実測値が蓄積してから検討する（別 Issue 化）。

- e2e カバレッジの収集と `app/(site)/**` の計測
- CI 実測値に基づく `app/api/**` の per-glob 閾値
- Codecov の Flags / Components による領域別の分離表示（`codecov.yml` の `comment.layout` は既に `flags, components` を要求しているが未定義で空になっている）
