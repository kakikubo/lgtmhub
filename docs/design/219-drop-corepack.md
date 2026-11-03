# pnpm の導入経路から Corepack を外す (#219)

## 結論

Corepack をやめ、pnpm 本体のバージョン自動切替（`pmOnFail` のデフォルト `download`）に任せます。`pnpm-workspace.yaml` の `pmOnFail: ignore` を削除するだけで、どの経路で入れた pnpm でも `packageManager` に書いたバージョンで動くようになります。これで Node.js 25 以降でも開発環境が壊れません。

## 設計

- `pmOnFail: ignore` を削除する。この設定は Corepack にバージョン管理を任せる前提で入れたもので（d3df159）、Corepack をやめれば不要になる
  - 実測: mise で入れた pnpm 11.13.0 で `pnpm_config_pm_on_fail=download pnpm -v` を実行すると `12.16.1` が返る
  - 副作用として、`pnpm-lock.yaml` の先頭に pnpm 本体の版と integrity を記録する boot document（`packageManagerDependencies`）が追加される。pnpm 12 以上を `packageManager` で固定していて `ignore` でない場合の[公式の挙動](https://pnpm.io/lockfile)なので、そのままコミットする
- pnpm の入れ方は自由にする（npm / mise / Homebrew / 公式インストーラ）。手順書では `npm i -g pnpm` を例に挙げる。どのバージョンを入れても、実行時に `packageManager` のバージョンへ切り替わる
- 置き換えるのは devcontainer の `postCreateCommand` と `.cursor/{install,start}.sh` の `corepack enable`。後者は「`pnpm` が無いときだけ `npm i -g pnpm`」にする
- ドキュメント（README / AGENTS.md / CLAUDE.md / docs/architecture.md / docs/development-guidelines.md）から Corepack 前提の記述を外す。README の Corepack 用トラブルシュートは削除し、「`corepack enable` 済みの環境では `corepack disable pnpm` を実行する」の 1 行に置き換える
- CI はすでに `pnpm/action-setup` が `packageManager` を読み、Node 26 で動いている。lefthook も `./node_modules/.bin/biome` を直接呼ぶので、どちらも変更しない

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| `pmOnFail: ignore` を残し、入れる pnpm のバージョンを各環境で `packageManager` に合わせる | devcontainer・Cursor・各開発者のマシンでバージョンを手で揃え続けることになり、Renovate が更新するたびにずれる |
| `npm i -g corepack` で Corepack を使い続ける | Node 本体から外れたツールに依存し続けることになる。過去に Corepack 0.34.4 以下と pnpm 12 の組み合わせで壊れた（pnpm 12 の `bin/pnpm.mjs` を解決できず lefthook が失敗） |
| `pmOnFail: error` にして、バージョンが違えば失敗させる | 自動で切り替えれば済むので、失敗させる理由がない |

## Non-goals

- `engines.node` や devcontainer イメージを Node 25 以上に上げること（Node のメジャー更新は手動運用。development-guidelines の該当節を参照）
- CI ワークフローの変更
