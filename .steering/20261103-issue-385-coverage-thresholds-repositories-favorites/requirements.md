# 要求内容: src/repositories と app/api/favorites にカバレッジ閾値を設定する (Issue #385)

## 背景

`apps/web/vitest.config.ts` の `coverage.thresholds` には `src/services/**` / `src/lib/**` / `app/api/images/**` しか無い。`app/api/auth/**` を外す理由はコメントに書かれているが、`src/repositories/**` と `app/api/favorites/**` を外す理由は書かれていない。Codecov は `informational: true` なので、これらのテストが消えても CI は失敗しない。

## 要求

- `src/repositories/**` と `app/api/favorites/**` に、CI 実測値を基にした閾値を追加する
- `docs/development-guidelines.md` と `docs/architecture.md` の閾値説明を、実際の設定と合わせる

## 受け入れ条件

- `pnpm run test:coverage` が新しい閾値の下で成功する
- 閾値は実測値より低く、未テストのコードが少し増えた程度で失敗する幅にする
- docs の閾値記述が `vitest.config.ts` と一致している
