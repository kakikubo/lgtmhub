# biome.json の $schema を CLI のバージョンに追従させる (#402)

## 結論

`$schema` を `./node_modules/@biomejs/biome/configuration_schema.json` に変える。インストール済みの CLI に同梱されたスキーマを指すので、lockfile だけの更新でも常に一致し、バージョン比較の info も出ない（手元で 453 files・診断 0 件を確認）。

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| `biome migrate --write` で URL を 2.6.3 に上げるだけ | 次の Renovate 更新で同じずれが再発する |
| Renovate の `postUpgradeTasks` で `biome migrate` を実行する | セルフホスト Renovate の `allowedCommands` が必要で、GitHub App 版では使えない |
| Renovate で `package.json` の範囲ごと上げ、`$schema` を regex manager で書き換える | 設定が増えるわりに、ローカル参照で済む問題を解いているだけ |

## Non-goals

- Biome のルール設定・Renovate 設定の変更
