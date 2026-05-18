# 要求内容

## 概要

カバレッジ閾値を **CI を含め常に有効なゲート**にし、PR #112 の暫定フラグ `VITEST_DISABLE_THRESHOLDS` を撤去する。env 差で CI が不安定にならないことを前提とする。

参照: GitHub Issue #113「カバレッジ閾値を CI でも常時ゲート化する（env 非依存化）」

## 背景

- PR #112（Codecov 導入）で `ci.yml` の `test` ジョブを `npm run test:coverage` 経由にしたところ、CI でカバレッジ閾値判定が fail した
- 170 テストは全 pass。落ちたのは閾値判定のみ
- CI(ubuntu / Node 24.x): `src/services/**` functions **88.23%** < 90%、`src/lib/**` functions **77.5%** < 80%
- ローカル(Node 24.9.0): functions 100% / 90.9%（その他 lines/statements/branches も閾値通過）
- 真因: **v8 の function カバレッジ計測は Node のマイナーバージョン差で数 % ブレる**（V8 エンジンの関数レンジ報告仕様が Node マイナーごとに変わるため。lines/statements は v8-to-istanbul でソースレンジにマップされ安定）
- 暫定対応（コミット `5b5a9a5`）として `VITEST_DISABLE_THRESHOLDS=true` を CI の `test:coverage` step に渡し、CI では閾値をゲートにせず計測のみ・閾値はローカル/devcontainer の開発者自己チェック用として維持していた

## 採用アプローチと却下理由（受け入れ条件「採用アプローチと却下理由を簡潔に記録」）

Issue の候補4案を検討し、ユーザー意思決定により **案4: 閾値を CI 実測ベースの現実的な値へ調整してゲートを復活** を採用。

| 案 | 内容 | 判定 | 理由 |
|----|------|------|------|
| 1 | Node を patch まで完全固定 | 却下 | CI/devcontainer/engines の3箇所を Node patch 更新ごとに手動同期する運用が高コスト。Renovate と恒常的に衝突。「シンプル第一」に反する |
| 2 | functions を閾値対象外にし lines/statements/branches のみゲート | 却下 | env 非依存で最小変更だが、ブレる functions をゲートから外すと関数網羅を CI で担保できない。品質基準を維持したいユーザー判断により不採用 |
| 3 | provider を istanbul に変更 | 却下 | functions も決定的計測でき4指標すべてゲート化できるが、依存差し替え・計測コスト増・閾値再キャリブレーションが必要で変更が重い |
| **4** | **閾値を CI 実測へ調整しゲート復活** | **採用** | **4指標すべて（functions 含む）をゲート維持できる。CI 実測フロアの下にバッファを取ることで approach 4 の範囲で最大限安定化** |

### 採用案の前提と既知トレードオフ（ユーザー承認済み）

- `functions` のブレ自体は解消しない。CI 実測フロア（services 88.23% / lib 77.5%）の **下** に安全バッファを取った値に閾値を引き下げ、単一 CI 観測点に対する余裕で再発リスクを抑える
- 将来の Node マイナー更新で観測済みより大きな下方ブレが出た場合、再 flaky 化の可能性が残る。これはユーザーが明示的に承認したトレードオフであり、ドキュメント・本ファイルに記録する
- `branches`/`lines`/`statements` は CI(Node 24.x) で 90/80 を通過済みのため据え置く（安定指標。Issue で fail したのは functions のみ）

## 実装対象

### 1. `vitest.config.ts`

- `VITEST_DISABLE_THRESHOLDS` による env 切替ロジック（`enforceThresholds` 変数と冒頭コメント）を撤去し、`thresholds` を常時適用する
- `functions` 閾値を CI 実測ベースへ引き下げ:
  - `src/services/**`: functions 90 → **85**（CI 実測 88.23% の下に約3pt バッファ）
  - `src/lib/**`: functions 80 → **75**（CI 実測 77.5% の下に約2.5pt バッファ）
- `branches`/`lines`/`statements` は services 90 / lib 80 を据え置く
- コメントを「functions は env ブレ吸収のため CI 実測ベースに引き下げ・閾値は CI 含め常時ゲート」に書き換え

### 2. `.github/workflows/ci.yml`

- `test` ジョブ `test:coverage` step の `env: VITEST_DISABLE_THRESHOLDS: "true"` を撤去
- 設計意図コメントを「閾値は CI 含め常時ゲート（functions は CI 実測ベースに調整）」へ更新

### 3. `docs/development-guidelines.md`

- 「テスト戦略 > カバレッジ目標」節: thresholds サンプルと説明段落を最終仕様（常時ゲート / functions 引き下げ / 採用理由）へ追従
- 「CI/CDパイプライン > Codecov」節: `VITEST_DISABLE_THRESHOLDS` 記述を撤去し「閾値は CI 含め常時ゲート」に更新
- 同節の ci.yml サンプル: `env: VITEST_DISABLE_THRESHOLDS` 行とコメントを実体に同期

## 受け入れ条件（Issue #113）

- [ ] CI の `npm run test:coverage` が閾値込みで安定して green（CI 実測フロアの下にバッファを取った閾値で再現性あり）
- [ ] 暫定フラグ `VITEST_DISABLE_THRESHOLDS` を撤去（`vitest.config.ts` / `ci.yml`）
- [ ] `docs/development-guidelines.md` を最終仕様に追従
- [ ] 採用アプローチと却下理由を簡潔に記録（本ファイル + ドキュメント）

## ローカル検証で満たすべき条件

- [ ] `npm run test:coverage` がローカル(Node 24.9.0)で 170 tests pass かつ閾値（services: branch90/func85/line90/stmt90、lib: branch80/func75/line80/stmt80）を満たす
- [ ] `VITEST_DISABLE_THRESHOLDS=true` を渡しても閾値が無視される旧挙動が消えている（env 分岐そのものが無い）
- [ ] `npm run lint` / `npm run typecheck` が通る

## スコープ外

- coverage provider の変更（istanbul 化）
- Node バージョンの patch 固定
- `functions` を閾値対象から外す構成変更
- `codecov.yml` の `informational: true` 解除（Codecov 側ゲート化は別関心事・運用安定後）
- テスト本体の追加・カバレッジ向上施策

## 参照

- GitHub Issue #113
- PR #112（Codecov 導入）/ 暫定対応コミット `5b5a9a5`
- `.steering/20260517-add-codecov/`（経緯・振り返り）
- `vitest.config.ts` / `.github/workflows/ci.yml` / `docs/development-guidelines.md`
