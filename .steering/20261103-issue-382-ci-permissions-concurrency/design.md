# ci.yml に permissions と concurrency を設定する (#382)

## 結論

```yaml
permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.event_name == 'pull_request' && github.ref || github.run_id }}
  cancel-in-progress: true
```

- 全ジョブが必要とするのは checkout の `contents: read` だけ。Codecov はトークン / tokenless、`actions/cache` と `actions/upload-artifact` は GITHUB_TOKEN の権限ではなく runner の `ACTIONS_RUNTIME_TOKEN` を使う
- PR は `refs/pull/N/merge` 単位でグループ化し古い run をキャンセルする。push（main）は `run_id` で run ごとに別グループにし、キャンセルも待機もさせない

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| Issue 記載の `group: ci-${{ github.ref }}` + `cancel-in-progress: ${{ github.event_name == 'pull_request' }}` | main では同一グループに待機 run が 1 つしか置けず、連続マージ時に中間コミットの pending run がキャンセルされる。Codecov の main ベースラインが欠ける |
| ジョブごとに `permissions` を書く | 全ジョブ同じ権限なのでトップレベル 1 箇所で足りる |

## 影響範囲

- `.github/workflows/ci.yml`
- `docs/development-guidelines.md`（GitHub Actions 節に 1 段落）
