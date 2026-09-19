# 要求内容

## 概要

pnpm 12 の `minimumReleaseAge`（24h）と Renovate の更新タイミングを揃え、Renovate が作った lockfile が CI の `pnpm install --frozen-lockfile` で拒否されないようにする。

## 背景

Renovate PR #328（`pnpm@12.4.2` への更新を含む）で、CI の `pnpm install --frozen-lockfile` が次で全滅した。

```
ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION
@types/node@24.13.6 was published at 2026-09-19T00:12:26Z,
within the minimumReleaseAge cutoff (~24h / 1440 分)
```

pnpm 12 系には組み込みの `minimumReleaseAge` デフォルト（1440 分）がある。一方 Renovate は `schedule: before 9am on monday`（Asia/Tokyo）で新しすぎる版も lockfile に取り込めるため、Renovate が通した lockfile を CI が供給チェーンポリシーで拒否するズレが起きている。

依存の破壊ではなく、**更新タイミングと成熟度ゲートの不一致**が原因。

参照: GitHub Issue [#339](https://github.com/kakikubo/lgtmhub/issues/339)

## 実装対象の機能

### 1. リポジトリで `minimumReleaseAge` を明示する
- `pnpm-workspace.yaml` に `minimumReleaseAge: 1440` を書き、pnpm 12 のデフォルトと同じ 24h ゲートをリポジトリの意図として固定する
- `.npmrc` には置かない（pnpm 12 では auth / registry 以外は workspace yaml が正）

### 2. Renovate に同等の冷却期間を入れる
- npm データソースに `minimumReleaseAge: "24 hours"` を設定する
- `internalChecksFilter: "strict"` を明示し、公開から 24h 未満の版を PR に載せない
- `minimumReleaseAgeExclude` は使わない

### 3. 運用を文書化する
- `docs/development-guidelines.md` の Renovate 節に 24h ゲートを追記する
- `docs/repository-structure.md` / `AGENTS.md` / `README.md` に意図を残す

## 受け入れ条件

### リポジトリで `minimumReleaseAge` を明示する
- [ ] `pnpm-workspace.yaml` に `minimumReleaseAge: 1440` がある
- [ ] `.npmrc` に `minimum-release-age` を追加していない

### Renovate に同等の冷却期間を入れる
- [ ] `renovate.json` の npm データソースに `minimumReleaseAge: "24 hours"` がある
- [ ] `internalChecksFilter` が `"strict"` である
- [ ] `packageRules` 末尾の `all non-major npm dependencies` 集約が維持されている
- [ ] `pnpm --package=renovate dlx renovate-config-validator renovate.json` が成功する

### 運用を文書化する
- [ ] `docs/development-guidelines.md` が 24h 冷却と除外リストを使わない方針を述べている
- [ ] `AGENTS.md` と `README.md` にゲートの短文がある

## 成功指標

- Renovate が公開直後の npm パッケージを PR に載せない
- 現行 lockfile に対する `pnpm install --frozen-lockfile` が成功する
- 既存の `pnpm run check` / `typecheck` / `test` が回帰しない

## スコープ外

以下はこのフェーズでは実装しません:

- PR #328 の依存更新そのもの
- `minimumReleaseAgeExclude`
- npm の 72h unpublish 窓に合わせて 3 days へ延ばすこと
- `prCreation: "not-pending"`（CI が `pull_request` のみのため PR 無限延期のリスクがある）

## 参照ドキュメント

- `docs/development-guidelines.md` - 依存関係管理 (Renovate)
- `docs/repository-structure.md` - `pnpm-workspace.yaml` / `renovate.json`
- `docs/architecture.md` - テクノロジースタック
- GitHub Issue [#339](https://github.com/kakikubo/lgtmhub/issues/339)
