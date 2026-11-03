# pnpm の導入経路から Corepack を外す (#219)

## 結論

Corepack をやめ、pnpm 本体のバージョン自動切替（`pmOnFail` のデフォルト `download`）に任せます。`pnpm-workspace.yaml` の `pmOnFail: ignore` を削除するだけで、pnpm 10 以上ならどの経路で入れても `packageManager` に書いたバージョンで動くようになります。導入手順では `packageManager` の版をそのまま入れます。これで Node.js 25 以降でも開発環境が壊れません。

## 設計

- `pmOnFail: ignore` を削除する。この設定は Corepack にバージョン管理を任せる前提で入れたもので（d3df159）、Corepack をやめれば不要になる
  - 実測: mise で入れた pnpm 11.13.0 で `pnpm_config_pm_on_fail=download pnpm -v` を実行すると `12.16.1` が返る
  - 副作用として、`pnpm-lock.yaml` の先頭に pnpm 本体の版と integrity を記録する boot document（`packageManagerDependencies`）が追加される。pnpm 12 以上を `packageManager` で固定していて `ignore` でない場合の[公式の挙動](https://pnpm.io/lockfile)なので、そのままコミットする
- devcontainer / Cursor / README の導入手順は、`packageManager` の版をそのまま `npm install -g` する。`npm i -g pnpm`（latest）だと、切り替える前に公開直後の pnpm が `minimumReleaseAge` の冷却を経ずに実行されるため。版は `packageManager` から読むので二重管理にならない
  - 手元では mise / Homebrew 等で入れてもよい。自動で切り替わるのは pnpm 10 以上（pnpm 9 は複数ドキュメントの lockfile を読めず `ERR_PNPM_BROKEN_LOCKFILE` で落ちる。origin/main でも overrides の不一致で落ちるため、今回の変更による悪化ではない）
  - `packageManager` に `+sha512...` のハッシュが付くと npm で直接 install できない。現状は付けていない
- 置き換えるのは devcontainer の `postCreateCommand` と `.cursor/{install,start}.sh` の `corepack enable`。後者は、リポジトリ外で確認した `pnpm -v` が `packageManager` と違うときだけ入れ直す（リポジトリ内では自動切替が効き、常に固定した版が表示されるため）
- ドキュメント（README / AGENTS.md / CLAUDE.md / docs/architecture.md / docs/development-guidelines.md）から Corepack 前提の記述を外す。README の Corepack 用トラブルシュートは削除し、「`corepack enable` 済みの環境では、先に `corepack disable pnpm` を実行してから pnpm を入れる」の案内に置き換える（後で実行すると npm で入れた pnpm のリンクも消える）
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
