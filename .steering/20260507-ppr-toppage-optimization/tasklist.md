# タスクリスト: トップページ PPR 適用検討と Suspense 境界導入

## 実装タスク (必須スコープ: Suspense 境界導入)

- [x] T1. `components/header-skeleton.tsx` を新規作成し、Header と同じ高さ・寸法を持つ skeleton を実装する
- [x] T2. `components/image-grid-skeleton.tsx` を新規作成し、ImageGrid と同じグリッド構成 (`grid-cols-2 md:grid-cols-3 xl:grid-cols-4`) で 8 個の placeholder を表示する
- [x] T3. `components/home-content.tsx` を新規作成し、`HomePage` の動的処理（auth 取得 + 画像取得 + 表示分岐 + ログイン CTA）を移設する
- [x] T4. `app/(site)/page.tsx` を同期 Server Component に書き換え、`<Suspense fallback={<ImageGridSkeleton/>}><HomeContent /></Suspense>` で囲む
- [x] T5. `app/(site)/layout.tsx` の `<Header />` を `<Suspense fallback={<HeaderSkeleton/>}><Header /></Suspense>` に置き換える

## 実装タスク (検討スコープ: PPR 有効化)

- [x] T6. T1〜T5 完了後に `npm run build` を実行し、Suspense 境界導入のみの状態でビルドが成功することを確認する (`/` は ƒ Dynamic のまま、`Compiled successfully in 4.0s` で成功)
- [x] T7. `next.config.ts` に `experimental.ppr: 'incremental'` を追加し、`app/(site)/page.tsx` に `export const experimental_ppr = true;` を追加する
- [x] T8. 再度 `npm run build` を実行 → **失敗**: `The experimental feature "experimental.ppr" can only be enabled when using the latest canary version of Next.js.` のため、設計通り T7 の変更を revert。Suspense 境界導入のみで PR を完結させる

## 検証タスク

- [x] V1. `npm run lint` を実行し pass を確認 (`npm run lint` の rtk プロキシ出力が壊れていたため `./node_modules/.bin/biome lint .` で直接実行 → 76 files checked, 0 errors)
- [x] V2. `npm run typecheck` を実行し pass を確認 (`tsc --noEmit` 成功)
- [x] V3. `npm test` を実行し pass を確認 (153 件 pass)
- [x] V4. implementation-validator サブエージェントによる検証を実行 (4/5)。フィードバックに基づき以下を反映:
  - `HeaderSkeleton` を `<header>` ランドマークに戻し設計と整合
  - `ImageGridSkeleton` を `<ul>+<li>` 構造に戻し ImageGrid と意味論一致
  - `ImageGridSkeleton` のボタン領域 `w-32` → `w-full` (CopyMarkdownButton と整合)
- [x] V5. `npm run build` の最終確認 — Suspense 境界導入のみで build 成功 (`Compiled successfully`、`/` は ƒ Dynamic、Static は `/_not-found` のみ)

## 申し送り (振り返り)

### 実装完了日

2026-05-07

### 実施結果サマリ

| 項目 | 結果 |
|------|------|
| Suspense 境界の導入 (Header / HomeContent) | ✅ 完了 |
| Skeleton コンポーネント新設 (HeaderSkeleton / ImageGridSkeleton) | ✅ 完了 |
| `app/(site)/page.tsx` の同期 Server Component 化 | ✅ 完了 |
| **PPR (`experimental.ppr: 'incremental'`) の有効化** | ❌ 失敗 → revert 済み |
| 既存テスト互換 (153 件 unit pass) | ✅ |
| `npm run build` 成功 | ✅ (`/` は ƒ Dynamic、Static は `/_not-found`) |

### 計画と実績の差分

#### 想定通り

- 必須スコープ T1〜T5 は設計のままコミット可能な品質で完了
- PPR の試行 (T7-T8) は事前の懸念通り stable な `next@15.5.15` ではビルド不能であることを実機確認できた
  - エラー: `The experimental feature "experimental.ppr" can only be enabled when using the latest canary version of Next.js.`

#### 想定との差分

- **Biome の a11y ルール `noAriaHiddenOnFocusable`**: 当初 `<header aria-hidden="true">` および `<ul aria-hidden="true">` で skeleton を a11y tree から隠す方針だったが、Biome の a11y ルールが `<header>` に対して `aria-hidden="true"` を拒否。一旦 `<div>` に逃げたが、implementation-validator の指摘で「Suspense 切替時に意味論が変わる」「Header と ImageGrid のランドマーク/リスト構造に揃えるべき」と判断し、最終的に `aria-hidden` なしの `<header>` / `<ul>` 構造に戻した。スクリーンリーダーが skeleton を一瞬読み上げる可能性があるが、Suspense 解決後は実体が出るため UX 上の許容範囲とした
- **lint コマンド**: `npm run lint` は手元の rtk (Rust Token Killer) プロキシで `ESLint output (JSON parse failed)` という壊れた出力になる現象を確認。直接 `./node_modules/.bin/biome lint .` で実行することで真の出力を確認できた

### 学んだこと

- **PPR は Next.js 15 系では canary 限定**: `next@15.5.15` (stable) で `experimental.ppr` を指定すると `next build` が即エラーで失敗する。Issue 内のリンク先 (https://nextjs.org/docs/app/guides/partial-prerendering) でも明示されている通り。今後 Next.js 15 系で PPR を実用したい場合は `next@canary` への switching が必要で、本リポジトリのバージョン管理ポリシー (`~15.5.15` パッチ固定) と矛盾するため、**PPR の本格採用は Next.js 16 stable リリース待ち** が現実解
- **Suspense 境界導入は PPR 単独の効果と無関係**: PPR が無効でも Suspense fallback は HTML ストリーミングに乗り、auth 取得と画像取得が並列化される。今回の改修だけで TTFB / 体感速度の改善が期待できる (Vercel preview デプロイで実測 → 別タスク)
- **Biome v2 の a11y ルールはタグレベルで focusable 判定する**: `<header>` 自体は実際には focusable ではないが、`noAriaHiddenOnFocusable` ルールは `<header>` に対しても警告を出す挙動。skeleton を a11y tree から隠したい場合は `aria-hidden` を付けず、Suspense 解決を待つ設計が無難

### 次回への改善提案

#### 直近 (本 PR / フォロー PR で実施推奨)

1. **Vercel preview デプロイで Lighthouse 計測**: TTFB / LCP の Before-After を `verification.md` として残し、PRD「LCP 3 秒以内」要件のエビデンスとして蓄積する
2. **HomeContent 内部の auth + 画像取得の並列化**: `Promise.all` で `auth.getUser()` と `getHomeImagesInitial()` を並走させると、`unstable_cache` が miss するときの初期表示が更に高速化する。現状は意図的に逐次にしているが、Phase 2 で再検討余地あり (implementation-validator の指摘 4)
3. **HeaderActions の細分化**: Header 内部で `signInWithGithub` と `signOut` の両形態をレンダリングする際、auth 値依存のプロフィール領域だけを子の Suspense に分離すると、ロゴ/ナビ等の固定領域がさらに早く出せる

#### 中期 (PPR 本体採用に向けて)

4. **Next.js 16 リリース後に PPR 再評価**: 本タスクの設計 (next.config.ts に `experimental.ppr: 'incremental'`、page.tsx に `experimental_ppr = true`) はそのまま使える状態で残してあるため、stable 化が確認でき次第切り替えるだけで適用可能
5. **`unstable_cache` → `'use cache'` ディレクティブ移行検討**: Next.js 15.x の `'use cache'` (canary) / `cacheLife` / `cacheTag` API への移行は PPR と相性が良く、PPR を採用する際は同時に検討する
6. **Static Shell 検証の自動化**: PPR 採用後は `.next/server/app/(site)/page/*.html` (静的 shell) と `*.meta` (postponed payload) の両方が生成されることを CI で確認できるとリグレッション防止になる

### スコープ外として保留した項目

- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) への Suspense / PPR 適用 (別タスク)
- ImageGrid 自体の `unstable_cache` 戦略変更 (本タスクは TTL 60 秒を維持)
- Lighthouse / Vercel Analytics での実数比較 (Vercel preview 後に別タスク)
