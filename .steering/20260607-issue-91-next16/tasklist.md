# タスクリスト: Next.js 16 アップグレード本体 (改訂プラン①)

## 実装

- [x] `package.json` の next を `~16.2.0` に更新
- [x] `pnpm install` で lockfile 更新（16.2.7 解決）
- [x] typecheck で `revalidateTag` の TS エラーを実証（2 箇所、TS2554）
- [x] `revalidateTag` 第 2 引数の型・推奨値を Next 16 ソースで確認（公式警告が `'max'` を案内）
- [x] `app/api/images/route.ts` の `revalidateTag` に `'max'` を追加
- [x] `app/api/images/[id]/route.ts` の `revalidateTag` に `'max'` を追加

## 検証

- [x] typecheck パス
- [x] build パス（Next 16.2.7 / Turbopack、Next 自動 tsconfig 変更を biome で正規化）
- [x] lint パス（worktree 制約のため明示パスで biome check）
- [x] unit + integration test パス（196 件）
- [x] implementation-validator サブエージェントで品質検証

## 振り返り

- **実装完了日**: 2026-06-07
- **計画と実績の差分**:
  - next 解決バージョンは計画の 16.2.6 ではなく `~16.2.0` 範囲の最新 **16.2.7**。
  - PR #91 (`renovate/major-next`) は #65 マージ前に分岐し stale だったため、ブランチへ手 commit せず最新 main ベースで再実装する方針に変更。
- **学んだこと**:
  - `revalidateTag` 第 2 引数の推奨値 `'max'` は Next.js 公式の deprecation 警告メッセージ自身が案内している（プランの想定が正しいと裏付け）。
  - 組み込み `'max'` プロファイル = stale 300s / revalidate 30日 / expire 365日。`next.config.ts` に cacheLife 未設定でもデフォルト解決され runtime エラーにならない。
  - Next 16 build は `tsconfig.json`(jsx→react-jsx, dev types include) と `next-env.d.ts`(import 化) を自動変更する。biome で整形を正規化すれば意味のある差分のみ残る。
  - worktree では `biome lint .` が exit 1（既知制約）。明示パスで `biome check` する。
- **次回への改善提案**:
  - プラン② (middleware→proxy) は build 時に deprecation 警告が出続けるため早めに着手するとノイズが減る。
  - プラン③ (cacheComponents) 着手時、`'use cache'` への移行で `revalidateTag(tag, 'max')` の `'max'` と `cacheLife('max')` を揃えておくと整合が取りやすい。
  - **未実施**: e2e (Playwright) は本作業では未実行。Next 16 のルーティング/RSC ストリーミング回帰確認のため、マージ前か CI で `pnpm test:e2e` を通すこと（RLS anon SELECT 前提の再確認も兼ねる）。
