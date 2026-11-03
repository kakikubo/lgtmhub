# 要求: biome.json の $schema を CLI のバージョンに追従させる (Issue #402)

## 問題

`biome.json` の `$schema` が URL で 2.6.2 を指す一方、lockfile の `@biomejs/biome` は 2.6.3 のため、`biome check` のたびに `deserialize` の info が出る。`package.json` は `^2.4.14` 指定なので、Renovate はロックファイルだけを更新し、`$schema` は手で移行するまで古いまま残る。

## 受け入れ条件

- `pnpm run check` で info を含む診断が 0 件になる
- 今後 Renovate が biome を上げても、`biome.json` を手で直さずに同じ状態を保てる
- エディタの `biome.json` 補完・検証が引き続き効く
- `check` / `typecheck` / `test` が通る

## スコープ外

- Biome のルール設定の変更
- Renovate 設定の変更
