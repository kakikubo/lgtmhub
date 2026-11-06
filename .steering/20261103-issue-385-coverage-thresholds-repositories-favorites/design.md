# 設計: src/repositories と app/api/favorites のカバレッジ閾値

## 結論

| glob | 実測 (statements / branches / functions / lines) | 閾値 |
|------|------|------|
| `src/repositories/**` | 100 (145/145) / 92.93 (92/99) / 100 (37/37) / 100 (111/111) | 95 / 90 / 95 / 95 |
| `app/api/favorites/**` | 92.77 (77/83) / 85.42 (41/48) / 100 (5/5) / 92.68 (76/82) | 90 / 80 / 95 / 90 |

実測値は 2026-11-03 にローカルで計測した。`vitest.config.ts` の `coverage.reporter` には `json-summary` が無いため、CLI から追加して `coverage/coverage-summary.json` を出力し、glob ごとに合算した（`apps/web` で実行）。

```bash
pnpm exec vitest run --coverage --coverage.reporter=json-summary
node -e '
const s = require("./coverage/coverage-summary.json");
for (const g of ["/src/repositories/", "/app/api/favorites/"]) {
  const t = { statements: [0, 0], branches: [0, 0], functions: [0, 0], lines: [0, 0] };
  for (const [f, v] of Object.entries(s)) if (f.includes(g)) for (const k in t) { t[k][0] += v[k].covered; t[k][1] += v[k].total; }
  console.log(g, Object.fromEntries(Object.entries(t).map(([k, [c, n]]) => [k, `${(100 * c / n).toFixed(2)} (${c}/${n})`])));
}'
```
CI 側は Codecov API（main, fb3a4ab）の totals で確認した。repositories は lines 140/140 ヒット、favorites は 88 行中 6 行ミスで、ローカルの未カバー 6 statements と一致する。Issue #266 で「CI とローカルは per-file で一致する」と確認済みなので、ローカルの指標別の値を基準にする。

## 閾値の決め方

`app/api/images/**`（Issue #259）と同じく、実測値から数 pt 下げた値にする。

- repositories の functions 95: 未テスト関数が 2 つ増えると 37/39 = 94.9% で失敗する
- repositories の branches 90: 未カバー分岐が 3 つほど増えると失敗する
- favorites の functions 95: 関数は 5 個しかないため、未テスト関数が 1 つ増えるだけで 5/6 = 83% になり失敗する
- favorites の branches 80: 未カバー分岐が 3 つほど増えると失敗する

## 代替案

| 案 | 却下理由 |
|----|----------|
| 実測値ぴったり（repositories 100 など） | 無害な分岐を 1 つ足しただけで CI が落ちる。既存の閾値もバッファを取っている |
| `src/repositories/**` を `src/services/**` と同じ 90/85/90/90 にする | 実測値 100 に対して緩すぎ、テストが消えても検知できない |
| Codecov の status をゲートにする | 二重ゲートを避けるため informational にした方針（Issue #113）に反する |
