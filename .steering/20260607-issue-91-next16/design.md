# 設計: Next.js 16 アップグレード本体

## 方針

PR #91 のブランチ `renovate/major-next` は #65（Supabase config push）マージ前に分岐しており stale。
そのため最新 main ベースの worktree ブランチ上で改訂プラン①を再実装し、クリーンな単一関心事 PR とする。

## 変更内容

### 1. バージョン bump
- `package.json`: `"next": "~15.5.15"` → `"~16.2.0"`（pnpm 解決で 16.2.7）
- `pnpm-lock.yaml`: 追従更新

### 2. `revalidateTag` の 2 引数化
Next 16 で `revalidateTag(tag: string, profile: string | { expire?: number })` と署名変更。
第 2 引数は cacheLife プロファイル。Next 公式の非推奨警告メッセージが
`add second argument of "max"` と案内しているため `'max'` を採用（プラン③の `cacheLife('max')` とも整合）。

- `app/api/images/route.ts:70`: `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')`
- `app/api/images/[id]/route.ts:32`: `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')`
- `HOME_IMAGES_CACHE_TAG` 定数を使う既存スタイルを維持（最小変更）

### 3. Next 16 自動生成変更（build により適用）
- `tsconfig.json`: `jsx: "preserve"` → `"react-jsx"`（Next 16 必須）、`.next/dev/types/**/*.ts` を include に追加
- `next-env.d.ts`: `/// <reference>` → `import` 形式（生成物）

## 非対応（意図的）

- `middleware.ts`: deprecation 警告が出るが動作する。proxy リネームはプラン②（別 PR）。
- `cacheComponents` / `'use cache'`: プラン③（別 PR）。
- `unstable_cache`: 16 でも動作。プラン③で `'use cache'` 移行予定。
