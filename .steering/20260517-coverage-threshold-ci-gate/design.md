# 設計

## 方針

PR #112 の暫定措置（env による閾値ゲート無効化）を撤去し、`vitest.config.ts` の `thresholds` を CI を含め常時適用する。env 差で唯一ブレる `functions` 閾値のみ CI 実測フロアの下にバッファを取った値へ引き下げ、approach 4 の範囲で安定性を確保する。安定指標（branches/lines/statements）は据え置く。

「シンプル第一・影響コード最小」原則に従い、変更は `vitest.config.ts` / `.github/workflows/ci.yml` / `docs/development-guidelines.md` の3ファイルに限定する。新規依存・新規ファイル・provider 変更・Node 固定は行わない。

## 閾値の根拠

| 範囲 | 指標 | ローカル(24.9.0) | CI(24.x) 実測 | 新閾値 | バッファ |
|------|------|-----------------|---------------|--------|----------|
| `src/services/**` | functions | 100% | **88.23%** | **85** | CI 実測 −3.2pt |
| `src/services/**` | branches | 97.5% | 通過(≥90) | 90（据置） | — |
| `src/services/**` | lines | 100% | 通過(≥90) | 90（据置） | — |
| `src/services/**` | statements | 100% | 通過(≥90) | 90（据置） | — |
| `src/lib/**` | functions | 90.9% | **77.5%** | **75** | CI 実測 −2.5pt |
| `src/lib/**` | branches | 90.9% | 通過(≥80) | 80（据置） | — |
| `src/lib/**` | lines | 91.07% | 通過(≥80) | 80（据置） | — |
| `src/lib/**` | statements | 91.07% | 通過(≥80) | 80（据置） | — |

- functions のみが Node マイナー差で約12〜13pt 下振れする（local→CI）。CI 実測値の **下** に閾値を置くことで、単一観測点に対しては安定 green になる
- branches/lines/statements は CI で 90/80 を通過済み（Issue で fail したのは functions のみ）。これらは v8-to-istanbul でソースレンジにマップされ安定するため据え置く

## 変更詳細

### vitest.config.ts

Before:
```ts
// v8 の function カバレッジ計測は Node のマイナーバージョン差で数 % ブレる。
// ...（VITEST_DISABLE_THRESHOLDS の説明コメント）...
const enforceThresholds = process.env.VITEST_DISABLE_THRESHOLDS !== 'true';
...
      ...(enforceThresholds
        ? {
            thresholds: {
              'src/services/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
              'src/lib/**': { branches: 80, functions: 80, lines: 80, statements: 80 },
            },
          }
        : {}),
```

After:
```ts
// 閾値は CI を含め常時ゲート。v8 の function 計測は Node マイナー差で
// 約 12〜13pt 下振れするため、functions のみ CI 実測フロア
// (services 88.23% / lib 77.5%) の下にバッファを取った値へ引き下げる。
// branches/lines/statements は v8-to-istanbul でソースレンジにマップされ
// 安定するため CI 実測でも通過する 90/80 を据え置く (Issue #113)。
...
      thresholds: {
        'src/services/**': { branches: 90, functions: 85, lines: 90, statements: 90 },
        'src/lib/**': { branches: 80, functions: 75, lines: 80, statements: 80 },
      },
```

- `enforceThresholds` 変数と `process.env.VITEST_DISABLE_THRESHOLDS` 参照、三項分岐を撤去し `thresholds` を直接記述する
- env 分岐が無くなることで `VITEST_DISABLE_THRESHOLDS=true` を渡しても閾値が無視されなくなる（旧挙動の完全撤去）

### .github/workflows/ci.yml

- `test` ジョブ `test:coverage` step の以下を撤去:
  ```yaml
        env:
          VITEST_DISABLE_THRESHOLDS: "true"
  ```
- 設計意図コメント（45〜48行目付近）を「閾値は CI 含め常時ゲート。functions は env ブレ吸収のため CI 実測ベースに調整済み」へ更新
- `npm run test:coverage` step 自体・Codecov アップロード step は不変

### docs/development-guidelines.md

1. 「カバレッジ目標」節（671〜682行付近）:
   - thresholds サンプルを `{ branches, functions, lines, statements }` 新値（services func85 / lib func75）に更新
   - 説明段落を「CI を含め常時ゲート。functions のみ env ブレ吸収で CI 実測ベースに引き下げ、branches/lines/statements は据え置き。採用理由は Issue #113」に書き換え（`VITEST_DISABLE_THRESHOLDS` / 「開発者向け自己チェック用」/「新規ゲート化はスコープ外」記述を撤去）
2. 「CI/CDパイプライン > Codecov」節（873〜881行付近）:
   - `VITEST_DISABLE_THRESHOLDS=true` を渡す記述を撤去し「閾値は `vitest.config.ts` で CI 含め常時ゲート。Codecov は可視化、二重ゲートにしない」に更新
   - ci.yml サンプル（806〜814行付近）の `env: VITEST_DISABLE_THRESHOLDS` 行と関連コメントを実体（撤去後）に同期

## 検証方針

1. `npm run test:coverage`（ローカル Node 24.9.0）: 170 tests pass + 新閾値達成を確認
2. `VITEST_DISABLE_THRESHOLDS=true npm run test:coverage`: 閾値が依然適用される（env が無効化されない）ことを確認 — 旧挙動撤去の証明
3. `npm run lint` / `npm run typecheck`: exit 0
4. `implementation-validator` サブエージェントで品質検証
5. ローカルでは functions が 100/90.9 と新閾値 85/75 を大きく上回るため、CI(実測 88.23/77.5)でも閾値超過する論理を tasklist の検証根拠に明記

## リスクと対応

| リスク | 対応 |
|--------|------|
| 将来 Node 更新で functions が観測済み(88.23/77.5)より大きく下振れ→再 flaky | ユーザー承認済みトレードオフ。ドキュメント・requirements に明記。再発時は別 Issue で案2/3 を再検討 |
| バッファ過小で初回 CI でも fail | CI 実測フロアの下に約3pt/2.5pt 取得済み。万一 fail 時はバッファ拡大で対応（tasklist 例外ルール） |
| docs サンプルと実体のドリフト | 既存「実際の ci.yml を正とする」注記を踏襲しつつ、今回該当箇所は実体同期する |
