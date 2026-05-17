# 設計書

## アーキテクチャ概要

CI の `test` ジョブで vitest のカバレッジを 1 パス計測し、`lcov.info` を `codecov/codecov-action@v5` で Codecov SaaS に送る。Codecov 側が PR コメント / ステータス / 時系列ダッシュボードを提供する。

```
[runner: ubuntu-latest / test ジョブ]
  │  (push:main と pull_request 両方でトリガー)
  ├─ checkout
  ├─ setup-node (24, cache: npm)
  ├─ npm ci
  ├─ npm run test:coverage     ← vitest run --coverage (unit+integration を 1 パス)
  │                               coverage/lcov.info を生成
  └─ codecov/codecov-action@v5 ← lcov.info を Codecov にアップロード
                                  (fail_ci_if_error: false で非ブロッキング)
        │
        ▼
   Codecov SaaS ──> PR コメント / project・patch ステータス / main 時系列グラフ / README バッジ
```

## コンポーネント設計

### 1. `vitest.config.ts` の coverage.reporter に lcov を追加

**責務**: Codecov が解釈する標準フォーマット (`coverage/lcov.info`) を生成する。

- 現状: `reporter: ['text', 'json', 'html']`
- 変更後: `reporter: ['text', 'json', 'html', 'lcov']`
- `text` は CI ログでの即時確認用に残す。`json` / `html` も既存どおり維持 (ローカル開発の利便性を壊さない)
- v8 provider は istanbul レポーター経由で出力するため `lcov` を足すだけで `coverage/lcov.info` が生成される
- 既存 `thresholds` (services 90% / lib 80%) は **変更しない**。ローカル / CI でのゲートは現状維持

### 2. `.github/workflows/ci.yml` の `test` ジョブ改修

**責務**: カバレッジ計測 + Codecov アップロード。

**変更点**:
- `- run: npm run test:unit` と `- run: npm run test:integration` の 2 ステップを、`- run: npm run test:coverage` の 1 ステップに置き換える
  - `test:coverage` = `vitest run --coverage`。`vitest.config.ts` の `include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx']` / `exclude: ['tests/e2e/**']` により unit + integration を 1 パスで実行する (e2e は対象外)
  - 現状 integration テストは存在しない (`tests/integration/.gitkeep` のみ) が、unit テストが存在するため `--passWithNoTests` 無しでも問題なし
  - `postgres` service は `test` ジョブに既存。将来 integration テストが追加されても DB 文脈は維持される
  - 二重実行 (split 実行 + 別途 coverage 実行) を避け、単一実行に統合することで CI コストを増やさない
- Codecov アップロードステップを末尾に追加:
  ```yaml
  - name: Upload coverage to Codecov
    uses: codecov/codecov-action@v5
    with:
      token: ${{ secrets.CODECOV_TOKEN }}
      files: ./coverage/lcov.info
      fail_ci_if_error: false
  ```
- 改修意図をコメントで残す (なぜ split をやめて coverage に統合したか)

**設計判断 — token の扱い**:
- 当リポジトリは **public**。`codecov/codecov-action@v5` は public リポジトリで token 未設定でも tokenless / OIDC でアップロード可能
- `CODECOV_TOKEN` secret が設定されていればそれを優先利用。未設定でも `${{ secrets.CODECOV_TOKEN }}` は空文字に解決され、public のため tokenless にフォールバックする
- これにより **secret 登録前でも CI は壊れない**。secret 登録は運用最適化として後追いで可能 (申し送り)

**設計判断 — `fail_ci_if_error: false`**:
- 今回の目的は「カバレッジの可視化」であり、Codecov へのアップロード可否を CI のゲートにしない
- Codecov 側のレート制限・一時障害・secret 未登録で `test` ジョブが赤くなるのを防ぐ
- カバレッジ自体のゲートは従来どおり `vitest.config.ts` の threshold が `test:coverage` 実行内で担保する (services 90% / lib 80%)

### 3. `codecov.yml` (リポジトリルート)

**責務**: Codecov のステータス / コメント / 計測対象の宣言。

```yaml
coverage:
  status:
    project:
      default:
        target: auto       # main 比でカバレッジが下がっていないか
        threshold: 1%       # 1% 以内の低下は許容 (誤検知抑制)
        informational: true # 表示するが必須チェックにしない
    patch:
      default:
        target: 80%         # 変更行の目標カバレッジ
        informational: true

comment:
  layout: "header, diff, flags, components"
  require_changes: false    # カバレッジ変化が無い PR でもコメントを残す

ignore:
  - "src/types/**"
  - "tests/**"
  - "**/*.test.ts"
```

**設計判断 — `informational: true`**:
- ユーザー要望は「分かるようにしておきたい」= 可視化が主目的。導入初手で merge をブロックすると運用摩擦になる
- ステータスは PR 上に表示されるが必須チェックにはせず、まず可視化を確立する。ゲート化は運用が回ってから別途検討 (スコープ外)

**設計判断 — `ignore`**:
- `vitest.config.ts` の `coverage.exclude` (`src/types/**`, `src/**/*.test.ts`) と整合させ、Codecov 側の集計でも型定義・テストコードをカバレッジ母数から外す
- vitest の `include` は `src/**` のみだが、Codecov 側でも明示しておくことで二重の安全策とする

### 4. README バッジ

**責務**: 現在のカバレッジを README で一目で示す。

- タイトル `# lgtmhub` 直下にバッジ行を追加
- `[![codecov](https://codecov.io/gh/kakikubo/lgtmhub/branch/main/graph/badge.svg)](https://codecov.io/gh/kakikubo/lgtmhub)`
- 既存 README の文体 (日本語説明) を壊さないよう、説明文の前にバッジのみを差し込む

### 5. `docs/development-guidelines.md` 更新

**責務**: 永続ドキュメントを実情に追従。

- 「CI/CDパイプライン」節の `ci.yml` サンプル (`test` ジョブ) を `npm run test:coverage` + Codecov ステップに更新
- Codecov について新規小節を追加: 目的 (可視化)、`informational` 方針、必要な手動設定 (Codecov リポジトリ連携 / `CODECOV_TOKEN` secret は任意) を明記
- 「カバレッジ目標」節は threshold を変えていないので原則維持。Codecov は threshold のゲートではなく可視化である旨を 1 行補足

## データフロー

```
1. PR 作成 / main へ push
2. CI: test ジョブ起動 (postgres service あり)
3. npm ci
4. npm run test:coverage
   - vitest が tests/**/*.test.ts(x) を実行 (e2e 除外)
   - v8 provider が src/** のカバレッジを集計
   - thresholds (services 90% / lib 80%) をこの実行内で検証
   - coverage/lcov.info, json, html, text を生成
5. codecov/codecov-action@v5
   - coverage/lcov.info を Codecov に送信
   - token があれば利用、無ければ public tokenless
   - 失敗しても CI は緑のまま (fail_ci_if_error: false)
6. Codecov SaaS
   - PR: 差分コメント + project/patch ステータス (informational)
   - main: 時系列グラフ更新 + README バッジ反映
```

## エラーハンドリング戦略

| 現象 | 原因 | 対策 |
|------|------|------|
| `npm run test:coverage` が threshold 未達で失敗 | services/lib のカバレッジ不足 | 既存ゲートと同じ挙動。今回の改修で新しく落ちることはない (閾値据え置き) |
| Codecov アップロード失敗 | レート制限 / 一時障害 / secret 未登録 | `fail_ci_if_error: false` で CI は緑維持。可視化は次回 run で回復 |
| `lcov.info` が生成されない | reporter 設定漏れ | `vitest.config.ts` に `lcov` を追加して担保。ローカル `npm run test:coverage` で `coverage/lcov.info` の存在を検証 |
| PR コメントが付かない | Codecov 側でリポジトリ未連携 | コード側の責務外。申し送りで「Codecov でリポジトリを有効化」を明記 |

## テスト戦略

### ローカル検証 (本作業の主検証手段)
- `npm run test:coverage` を実行し、(a) 既存 unit テストが pass、(b) `coverage/lcov.info` が生成されることを確認
- `npm run lint` / `npm run typecheck` が通ること (設定ファイル変更が biome / tsc を壊さないこと)

### CI 検証
- push 後、`test` ジョブが緑になること
- `codecov/codecov-action@v5` ステップが実行され、アップロード結果がログに出ること
- (Codecov 連携後) PR に差分コメント / ステータスが出ること

## 依存ライブラリ

- **npm 依存の追加なし**。`@vitest/coverage-v8` は既存
- `codecov/codecov-action@v5` は GitHub Action (npm 非依存)。`renovate.json` の `github-actions` グループで自動更新対象に入る

## ディレクトリ構造

```
vitest.config.ts                     (改修: reporter に lcov 追加)
.github/workflows/ci.yml             (改修: test ジョブ)
codecov.yml                          (新規)
README.md                            (改修: バッジ追加)
docs/development-guidelines.md       (改修: CI/CD 節)
.steering/20260517-add-codecov/
  ├─ requirements.md
  ├─ design.md
  └─ tasklist.md
```

## 実装の順序

1. `vitest.config.ts` に `lcov` reporter を追加
2. `codecov.yml` を作成
3. `.github/workflows/ci.yml` の `test` ジョブを改修
4. README にバッジ追加
5. `docs/development-guidelines.md` を更新
6. ローカルで `npm run test:coverage` / `lint` / `typecheck` を検証
7. implementation-validator で品質検証
8. 振り返り + push して CI 確認 (CI 確認はマージ前運用)

## セキュリティ考慮事項

- public リポジトリのためカバレッジレポートに機密は含まれない (ソース行カバレッジのみ)
- `CODECOV_TOKEN` は任意。設定する場合は GitHub Secrets に格納し、ワークフローには平文で書かない (`${{ secrets.CODECOV_TOKEN }}` 参照のみ)
- fork PR からの secret 露出: public リポジトリの fork PR では secret が渡らないが、tokenless にフォールバックするため動作する。`fail_ci_if_error: false` で fork PR でも CI は緑
- 本変更は production / preview デプロイには一切触らない (CI ジョブのみ)

## パフォーマンス考慮事項

- split 実行 (`test:unit` + `test:integration`) → 単一 `test:coverage` 実行へ統合するため、テスト実行回数は増えない。カバレッジ計測 (v8) のオーバーヘッドのみ追加 (現状のテスト規模では数秒オーダー)
- Codecov アップロードは数秒。CI 全体への影響は軽微

## 将来の拡張性

- 運用が安定したら `codecov.yml` の `informational: true` を外して patch カバレッジを必須ゲート化できる
- Codecov の Flags / Components で `src/services` と `src/lib` を分離表示し、`vitest.config.ts` の threshold 方針と対応付けられる
- e2e (Playwright) のカバレッジを別 flag で送る拡張も将来検討可能 (本作業ではスコープ外)
