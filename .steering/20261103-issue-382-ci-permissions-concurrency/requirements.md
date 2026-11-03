# 要求: ci.yml に permissions と concurrency を設定する (Issue #382)

## 背景

- `.github/workflows/ci.yml` に `permissions` が無く、全ジョブが GITHUB_TOKEN の既定権限で動く。`pnpm install` が依存のスクリプトを実行するため、侵害時の影響範囲が広い
- `concurrency` が無く、同一 PR への連続 push で古い run（e2e は最大 20 分）が止まらない

## 受け入れ条件

- `ci.yml` のトップレベルに `permissions: contents: read` がある
- 同一 PR の新しい run が古い run をキャンセルする
- main への push の run はキャンセルされない（Codecov の main ベースラインを欠かさない）
- 既存ジョブ（lint / test / e2e / security）が新しい権限で成功する
- `docs/development-guidelines.md` の GitHub Actions 節に方針を記す

## Non-goals

- 他 workflow の権限見直し（既に明示済み）
- ジョブ単位の権限細分化
