# 設計書

## アーキテクチャ概要

e2e ジョブの成果物を GitHub Actions のアーティファクトに残す。アプリコードと Playwright の実行設定は変更しない。

```
e2e ジョブ
  pnpm run test:e2e
    ├─ playwright-report/   (html reporter)
    └─ test-results/        (trace on-first-retry)
  Upload Playwright report  (if: always())
  Stop Supabase Local       (if: always())
```

## コンポーネント設計

### 1. upload-artifact ステップ

**責務**:
- e2e 成否にかかわらず Playwright 成果物を保存する

**実装の要点**:
- `actions/upload-artifact@v7`（公開時点の latest major。他 action と同様に major のみ指定し Renovate に任せる）
- `if: always()`（失敗時にこそ必要。Issue の指定どおり）
- `name: playwright-report`
- `path` は `playwright-report/` と `test-results/` の 2 つを 1 アーティファクトにまとめる（ダウンロード 1 回で HTML + trace）
- `retention-days: 7`
- 成功かつリトライなしだと `test-results/` が空になりうるので `if-no-files-found: ignore`
- 配置は `pnpm run test:e2e` の直後、`Stop Supabase Local` の前

### 2. ドキュメント

**責務**:
- CI が e2e 成果物を保存する方針をガイドラインに残す

**実装の要点**:
- 正典は `docs/development-guidelines.md` の「CI/CDパイプライン > GitHub Actions」
- 短い説明（失敗時も `playwright-report/` と `test-results/` を 7 日保存する）を Playwright キャッシュの説明の直後に置く
- サンプル YAML の e2e 末尾に upload ステップを足す。action のバージョンは従来どおり「ci.yml を正」とする注記のまま触らない
- `docs/architecture.md` は CI 詳細を guidelines に委譲しているため変更しない

## データフロー

### e2e 成功（リトライなし）
```
1. playwright test が playwright-report/ を生成する
2. test-results/ は空または最小
3. upload-artifact が playwright-report を保存する（空の test-results は ignore）
4. supabase stop
```

### e2e 失敗（リトライあり）
```
1. 初回失敗後のリトライで trace が test-results/ に残る
2. html reporter が playwright-report/ を生成する
3. テストが非 0 終了しても if: always() で upload する
4. supabase stop
```

## エラーハンドリング戦略

### カスタムエラークラス

なし（CI ワークフローのみ）

### エラーハンドリングパターン

- テスト失敗後も upload するため `if: always()`
- 成果物が無い場合にジョブを落とさないため `if-no-files-found: ignore`
- upload 失敗しても `Stop Supabase Local` は `if: always()` で走る

## テスト戦略

### ユニットテスト
- 対象なし（YAML / ドキュメントのみ）

### 統合テスト
- 対象なし

### CI 上の検証
- 本 PR の e2e 成功 run で Summary から `playwright-report` をダウンロードできること
- ジョブ時間が目に見えて延びないこと
- trace の実在確認は、意図的に落ちるテストを入れないため、次回の実失敗／リトライで担保する

## 依存ライブラリ

新規 npm パッケージは追加しない。GitHub Action として `actions/upload-artifact@v7` を使う。

## ディレクトリ構造

```
.github/workflows/ci.yml
docs/development-guidelines.md
.steering/20260920-issue-346-playwright-artifacts/
```

## 実装の順序

1. e2e ジョブに upload ステップを追加する
2. `docs/development-guidelines.md` を更新する
3. `pnpm run check` で Markdown を検証する

## セキュリティ考慮事項

- アーティファクトに秘密情報を含めない。Playwright レポートはテスト結果・trace・スクリーンショット相当のみ
- `E2E_TEST_MODE` や service_role キーはレポートに出さない前提を維持する

## パフォーマンス考慮事項

- 対象パスを 2 ディレクトリに限定し、retention を 7 日にして保存量を抑える
- 成功時の HTML レポートは数 MB 程度を想定し、ジョブ時間への影響は小さい

## 将来の拡張性

- 必要になったら `screenshot: 'only-on-failure'` を足せば、同じ upload パスでスクリーンショットも残る
- アーティファクトを 2 つに分ける必要が出たら `name` を分けて path を分割できる
