# タスクリスト: Codecov 導入

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: カバレッジレポート出力

- [x] T1-1 `vitest.config.ts` の `coverage.reporter` に `lcov` を追加 (`['text','json','html','lcov']`)
- [x] T1-2 既存 `thresholds` (services 90% / lib 80%) を変更していないことを確認

## フェーズ 2: Codecov 設定

- [x] T2-1 リポジトリルートに `codecov.yml` を作成 (project/patch を `informational: true`、PR コメント、ignore)
- [x] T2-2 `ignore` が `vitest.config.ts` の `coverage.exclude` と整合していることを確認

## フェーズ 3: CI ワークフロー改修

- [x] T3-1 `.github/workflows/ci.yml` の `test` ジョブで `test:unit` + `test:integration` を `npm run test:coverage` 1 ステップに置き換え
- [x] T3-2 `codecov/codecov-action@v5` アップロードステップを追加 (token / files / fail_ci_if_error: false)
- [x] T3-3 改修意図のコメントを `test` ジョブに追記 (split→coverage 統合の理由 / 非ブロッキング方針)

## フェーズ 4: 可視化

- [x] T4-1 README タイトル直下に Codecov バッジを追加

## フェーズ 5: ドキュメント更新

- [x] T5-1 `docs/development-guidelines.md`「CI/CDパイプライン」節の `ci.yml` サンプル (test ジョブ) を更新
- [x] T5-2 同節に Codecov 小節を追加 (目的=可視化 / informational 方針 / 必要な手動設定) + カバレッジ目標節に 1 行補足

## フェーズ 6: 検証

- [x] T6-1 `npm run test:coverage` を実行し、unit テスト全 pass + `coverage/lcov.info` 生成を確認 (170 tests pass / thresholds 達成 / lcov.info 14.4K 生成)
- [x] T6-2 `npm run lint` が通ることを確認 (exit 0 / vitest.config.ts 単体も clean)
- [x] T6-3 `npm run typecheck` が通ることを確認 (tsc --noEmit エラーなし)
- [x] T6-4 `implementation-validator` サブエージェントで品質検証 (総合 4.8/5。指摘の docs バージョン整合は注記追加で対応、codecov.yml ignore は安全な superset のため据え置き)

## フェーズ 7: 振り返り

- [x] T7-1 本ファイル末尾の「実装後の振り返り」を記載 (完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案 / 申し送り)

---

## 実装後の振り返り

### 実装完了日
2026-05-17

### 実装サマリー

- `vitest.config.ts` の `coverage.reporter` に `lcov` を追加 (`coverage/lcov.info` を生成)。既存 thresholds は不変
- `.github/workflows/ci.yml` の `test` ジョブで `test:unit` + `test:integration` を `npm run test:coverage` の 1 パスに統合し、`codecov/codecov-action@v5` で lcov をアップロードするステップを追加 (token 任意 / `fail_ci_if_error: false`)
- リポジトリルートに `codecov.yml` を新規作成 (project/patch は `informational: true` で非ブロッキング、PR コメント、ignore は vitest exclude と整合)
- README タイトル直下に Codecov バッジを追加
- `docs/development-guidelines.md` の CI/CD 節サンプル更新 + Codecov 小節追加 + カバレッジ目標節に役割分担の 1 行補足 + 「実際の ci.yml を正とする」注記を追加
- 検証: `npm run test:coverage` 170 tests pass / thresholds 達成 / `coverage/lcov.info` 14.4K 生成、`lint` / `typecheck` exit 0
- `implementation-validator` 総合 4.8/5

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| ドキュメント更新範囲 | CI/CD 節 + カバレッジ目標 1 行 | + validator 指摘により「実際の ci.yml を正とする」注記と codecov-action の renovate 自動更新の記載を追加 |
| codecov.yml の ignore | `src/**/*.test.ts` で整合 | `**/*.test.ts` (より広く安全な superset)。`tests/**` と併せテストコード全体を確実に除外できるため据え置き |
| lint 確認 | `npm run lint` のみ | rtk フィルタで出力が壊れたため `vitest.config.ts` 単体 lint も追加実施し clean を確認 |

### 学んだこと

1. **既存資産がほぼ揃っていた**: `@vitest/coverage-v8` / `test:coverage` スクリプト / coverage 設定は既存。Codecov 導入の本質は「CI でカバレッジを計測し外部に送る配線」だけで、npm 依存追加はゼロで済んだ。最小変更原則に合致
2. **split → 単一 coverage 実行の統合がコスト中立**: `test:unit`+`test:integration` を `test:coverage` に置換しても、`vitest.config.ts` の include/exclude により実行対象は同一 (e2e 除外)。二重実行を避けつつカバレッジを得られる
3. **public リポジトリの tokenless が secret 未登録時の安全弁**: `${{ secrets.CODECOV_TOKEN }}` は未登録なら空文字に解決され public では tokenless にフォールバック。`fail_ci_if_error: false` と併せ、Codecov 側の手動セットアップ前でも CI が壊れない設計にできた
4. **可視化とゲートの責務分離を明文化する重要性**: カバレッジのゲートは `vitest.config.ts` の thresholds、Codecov は可視化、と役割をドキュメントに明記しないと将来 `codecov.yml` を二重ゲート化する誤改修を招きやすい

### 次回への改善提案

1. **運用安定後のゲート化検討**: 可視化が定着したら `codecov.yml` の `informational: true` を外し patch カバレッジを必須チェック化することを別 PR で検討
2. **docs サンプルのバージョンドリフト**: `docs/development-guidelines.md` の ci.yml サンプルは `@v4` / `postgres:16` 等で実体 (`@v6` / `postgres:18`) とずれている。今回は注記追加で回避したが、別 PR でサンプル全体を実体に同期させると親切 (本 PR スコープ外 = 1PR1関心事)
3. **Flags / Components 化**: `src/services` (90%) と `src/lib` (80%) を Codecov の Components で分離表示すると thresholds 方針と対応付く。運用後に検討

### 申し送り事項 (リポジトリ管理者の手動作業 — Claude では実行不可)

1. **Codecov リポジトリ有効化 (必須)**: https://codecov.io に GitHub アカウントでサインインし `kakikubo/lgtmhub` を有効化する。これを行わないと PR コメント / ダッシュボード / バッジが機能しない (CI 自体は緑のまま)
2. **`CODECOV_TOKEN` 登録 (任意・推奨)**: GitHub の Settings → Secrets and variables → Actions に `CODECOV_TOKEN` を登録するとレート制限リスクを低減できる。public リポジトリのため未登録でも tokenless で動作する
3. **ブランチ保護**: 現状 Codecov ステータスは `informational: true` で非必須。必須化する場合は GitHub のブランチ保護ルールで Codecov チェックを必須に追加する (今回はスコープ外)
