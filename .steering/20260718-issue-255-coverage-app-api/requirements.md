# 要求内容

## 概要

`vitest.config.ts` の `coverage.include` に `app/api/**/*.ts` を追加し、テスト済みの route handler がカバレッジ計測に反映される状態にする。Issue #255。

## 背景

- Codecov は 2026-05-17 に導入済み (`.steering/20260517-add-codecov/`)。CI でのアップロード・`codecov.yml`・README バッジ・`CODECOV_TOKEN` すべて稼働している
- しかし `coverage.include` が `['src/**/*.ts', 'src/**/*.tsx']` のみで、`app/**` が計測対象外になっている
- 一方 `tests/unit/api/` には route handler のテストが 6 本存在し、`app/api/**` の 6 つの `route.ts` を実際にカバーしている
- つまり**テストは書かれているのにカバレッジに現れない**状態であり、表示中の 95% は「アプリの一部だけを見た 95%」として実態を過大に表している
- 導入時の申し送り (`.steering/20260517-add-codecov/tasklist.md`) には計測範囲の項目は無く、この漏れは今回のレビューで初めて検出された

## 実装対象の機能

### 1. `app/api/**` を計測対象に追加

- `vitest.config.ts` の `coverage.include` に `'app/api/**/*.ts'` を追加する
- `coverage.exclude` と `coverage.thresholds` は変更しない

### 2. ドキュメントの同期

- `docs/development-guidelines.md` の以下 2 箇所を、今回の変更で事実と食い違わないよう更新する
  - L690 付近「カバレッジ目標」の `coverage` 設定スニペット
  - L900 付近「集計対象」の記述（`codecov.yml` の ignore と vitest の exclude の整合について述べている箇所）

## 受け入れ条件

### app/api の計測

- `pnpm run test:coverage` の実行後、`coverage/lcov.info` に `app/api` 配下の 6 つの `route.ts` すべてが `SF:` 行として出力される
- 既存テストは全件 pass する
- `src/services/**` / `src/lib/**` の既存 thresholds は変更されず、かつ引き続き通過する

### Codecov への反映

- PR 上で CI の `test` ジョブがグリーンになる
- Codecov の PR コメントに `app/api` の route が現れる（角括弧を含むパス `app/api/images/[id]/route.ts` が正しく取り込まれることの確認を兼ねる）

### ドキュメント

- `docs/development-guidelines.md` の記述が `vitest.config.ts` の実体と一致する

## 成功指標

- カバレッジ計測対象が 23 ファイル (`src/**` のみ) から 29 ファイル (`+ app/api/**` 6 件) に増える
- Codecov 上で route handler のカバレッジ推移が追跡可能になる

## スコープ外

以下は別 Issue とし、本作業では扱わない（1PR = 1関心事）。

- **`app/(site)/**` の計測**: RSC のページ/レイアウトは `environment: 'node'` の unit テストから import されず、実際には e2e (Playwright) がカバーしている。e2e カバレッジを収集していない現状で include に加えると、テスト済みのコードが恒久的に 0% と表示され、対処不能な赤を生む
- **`app/api/**` への per-glob 閾値の設定**: CI 実測値が無い状態で閾値を置くと、v8 の functions 計測の env 差 (Issue #113、約 12〜13pt) により CI だけが落ちる。PR #112 で同種のスコープ違反を起こした前例がある
- **`app/api/images/route.ts` のテスト補強**: 現状 34.88% で今回のバッジ下落の主因だが、「計測範囲の修正」と「テスト追加」は別の関心事
- **`docs/development-guidelines.md` の既存ドリフト解消**: L838 のサンプルが `codecov-action@v5`（実体は `@v7`）、L902 が完了済みの手動セットアップを未着手 TODO として記載。いずれも今回の変更が原因ではない

## 参照ドキュメント

- Issue #255
- `.steering/20260517-add-codecov/` (Codecov 導入時の計画と振り返り)
- Issue #113 / `.steering/20260517-coverage-threshold-ci-gate/` (v8 functions の env 差と閾値方針)
- `docs/development-guidelines.md` 「カバレッジ目標」「CI/CDパイプライン > Codecov」
