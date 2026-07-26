# 要求: Next.js 16 アップグレード (#91 / Issue #54 改訂プラン①)

## 背景

Issue #54（トップページ PPR 検討）の再検討メモにて、Next.js 16 リリース（PR #91）を踏まえ計画を 3 PR に分割。本作業はその **改訂プラン①（PR #91 本体）** を完遂する。

- 参照: https://github.com/kakikubo/lgtmhub/issues/54 (再検討メモ)
- 参照 PR: https://github.com/kakikubo/lgtmhub/pull/91 (Renovate)

## スコープ（改訂プラン①のみ）

- `next` を `~15.5.15` → `~16.2.0`（実体 16.2.7）へアップグレード
- Next.js 16 で 2 引数必須化された `revalidateTag` の TypeScript エラー解消
  - `app/api/images/route.ts`
  - `app/api/images/[id]/route.ts`

## スコープ外（別 PR）

- ② `middleware.ts → proxy.ts` リネーム（Follow-up PR）
- ③ `cacheComponents: true` 有効化 + `'use cache'` 移行 + Lighthouse 計測（Issue #54-revised PR）

## 完了条件

- typecheck / build / lint / unit+integration test が全てパス
- 変更は単一関心事（Next 16 アップグレード本体）に限定
