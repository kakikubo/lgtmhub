# GitHub Actions の SHA 固定とサードパーティ action の automerge 停止 (#383)

## 結論
全 workflow の `uses:` を `@<sha> # vX.Y.Z` に固定し、`helpers:pinGitHubActionDigests` で Renovate に固定を維持させる。
automerge は GitHub 公式（`actions/*`）の非 major 更新だけに残し、サードパーティ action は人がレビューしてマージする。
全 workflow が secrets か write 権限を持つため、workflow 単位ではなく action の発行元で線を引く。

## 設計
- `renovate.json`
  - `extends` に `helpers:pinGitHubActionDigests` を追加する
  - 既存の `github-actions` グループを 2 つに分ける
    - `github-actions (official)`: `actions/**`。automerge は汎用ルール（minor/patch/pin/digest は true、major は false）に任せる
    - `github-actions (third-party)`: それ以外。`automerge: false`
- workflow の固定はこの PR で行う（Renovate の pin PR を待つと、それ自体が automerge されるため）

| action | 固定先 |
|---|---|
| actions/checkout | v7.0.1 |
| actions/setup-node | v7.1.0 |
| actions/cache | v6.1.0 |
| actions/upload-artifact | v7.0.2 |
| pnpm/action-setup | v6.0.10 |
| codecov/codecov-action | v7.1.1 |
| supabase/setup-cli | v3.0.1 |
| release-drafter/release-drafter | v7.10.0 |

## 検討した代替案
| 案 | 却下理由 |
|---|---|
| secrets / write 権限を持つ workflow（`matchFileNames`）だけ automerge を外す | 全 workflow が該当し、実質「全 action の automerge 停止」と同じ。公式 action まで手動にする利点がない |
| github-actions の automerge を全停止 | `actions/*` は GitHub 自身が発行元で、タグ付け替えのリスクがサードパーティより小さい。週次の手動マージを増やすだけ |
| SHA 固定のみで automerge は現状維持 | 固定後もタグ付け替えは digest 更新 PR として届くため、automerge のままだと結局レビュー無しで取り込まれる |

## Non-goals
- github-actions への `minimumReleaseAge` 設定
- workflow の `permissions` の最小化
