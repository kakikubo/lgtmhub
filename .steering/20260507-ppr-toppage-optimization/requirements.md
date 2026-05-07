# 要求: トップページ PPR (Partial Pre-Rendering) 適用検討と Suspense 境界導入

## 関連 Issue

- [#54 【調査】トップページの描画速度高速化：PPR（Partial Pre-Rendering）適用検討](https://github.com/kakikubo/lgtmhub/issues/54)

## 背景

トップページ (`app/(site)/page.tsx`) の描画速度（特に LCP）改善を目的に、Next.js 15 が提供する PPR の適用可否を検討する。前回 PR (`20260506-lcp-priority-image`) で画像 preload を最適化したが、ページ自体は完全な動的レンダリング (`async/await` 直列実行) のままで、HTML ストリーミング・静的シェル配信の恩恵を受けていない。

## 現状の課題

### 1. Suspense 境界が一切設定されていない

- `app/(site)/layout.tsx` は `<Header />` を直接埋め込んでおり、Header 内部の `await supabase.auth.getUser()` が完了するまで HTML 送信がブロックされる
- `app/(site)/page.tsx` も `await supabase.auth.getUser()` と `await getHomeImagesInitial()` を直列で await しているため、画像一覧キャッシュヒット時もユーザー認証取得を待つ

### 2. Header と ImageGrid の依存性が異なるのに同じレンダリングフェーズに乗っている

| 領域 | 依存 | 動的/静的 |
|------|------|----------|
| ページ骨格（`<section>` / `<h1>`） | なし | 静的 (ビルド時 prerender 可能) |
| ImageGrid（`unstable_cache` 60 秒 TTL） | Supabase anon | 準静的 (キャッシュから即時返却可能) |
| Header の認証済み UI | Cookie / Supabase auth | 動的 (リクエスト時) |
| ログイン/ログアウト誘導 | Supabase auth | 動的 (リクエスト時) |

### 3. PPR 設定が存在しない

`next.config.ts` に `experimental.ppr` の設定がなく、ページにも `experimental_ppr` のオプトインがない。

## 環境

| 項目 | バージョン |
|------|-----------|
| Next.js | `~15.5.15` (stable) |
| React | `^19.2.5` |
| Supabase SSR | `^0.10.2` |
| Vercel Blob | `^2.3.3` |

> **重要前提**: PPR は Next.js 15 系では canary 限定機能と公式に明記されている。stable な `next@15.5.15` の `next build` 時に `experimental.ppr` を指定すると、現状のリリースでは「Partial Prerendering (PPR) is an experimental feature... only available on canary」エラーで失敗する可能性が高い。Issue #54 の主目的は **PPR 適用検討** であり、PPR が現環境で適用不能だった場合は **PPR 設定は外し、Suspense 境界導入と並列化のみ採用する** 方針を許容する。

## 今回の実装スコープ

### 必須スコープ（PPR 可否に関わらず実施）

トップページに Suspense 境界を導入し、HTML ストリーミングと並列化を行う。これは PPR の前提条件であり、PPR 単独でも単独で TTFB を改善する。

1. **layout.tsx の Header を Suspense で囲む** — `<HeaderSkeleton />` を fallback とする
2. **page.tsx の動的部分を子コンポーネントに分離** — auth 依存部分とログインボタンを `<HomeAuthSection />` のような子に切り出し、Suspense で囲む
3. **page.tsx の画像一覧部分を Suspense で囲む** — `<ImageListSection />` を子コンポーネントに切り出し、`<ImageGridSkeleton />` を fallback とする
4. **HeaderSkeleton / ImageGridSkeleton コンポーネントの新設** — レイアウトシフトを抑える形

### 検討スコープ（PPR 本体）

5. **PPR の現環境での適用可否を実測する** — `next.config.ts` に `experimental.ppr: 'incremental'` を追加し、`app/(site)/page.tsx` に `export const experimental_ppr = true` を付与して `npm run build` を試す。失敗ログをドキュメントに残す
6. **適用可能だった場合**: そのままコミットして PPR 有効化を行う
7. **適用不可だった場合**: 設定を取り除き、Suspense 境界導入のみで PR を完結させ、申し送りに「next の canary or 16+ stable で再検討」と記す

## 受け入れ条件

### 機能要件 (必須スコープ)

- [ ] `<Header />` が `<Suspense fallback={<HeaderSkeleton />}>` で囲まれている
- [ ] `app/(site)/page.tsx` の auth 取得ロジックが子コンポーネントに切り出され、Suspense で囲まれている
- [ ] `app/(site)/page.tsx` の画像一覧取得が子コンポーネントに切り出され、`<Suspense fallback={<ImageGridSkeleton />}>` で囲まれている
- [ ] HeaderSkeleton / ImageGridSkeleton はレイアウトシフトを最小限に抑える寸法で実装されている
- [ ] エラーハンドリング（一覧取得失敗時の `LoadErrorState` 表示、空状態の `EmptyState` 表示）が引き続き機能する

### 機能要件 (検討スコープ)

- [ ] `next.config.ts` に `experimental.ppr` の設定試行が行われ、結果（成功 or 失敗）がドキュメント化されている
- [ ] PPR 有効化が成功した場合のみ設定を残す。失敗した場合は revert する

### 品質 / 検証

- [ ] `npm run lint` / `npm run typecheck` / `npm test` がエラーなく通る
- [ ] 既存 E2E (`tests/e2e/image-list.test.ts`, `tests/e2e/auth-callback.test.ts` など) が引き続き通る
- [ ] `npm run build` が成功する
- [ ] PPR 有効化に成功した場合、`.next/server/app/(site)/page/` に **静的シェル** (.html prerender 出力) と **postponed payload** (.meta) の双方が生成されていることをログ確認する

## 今回スコープ外 (意図的に除外)

- ImageGrid の Suspense 内部での `unstable_cache` 戦略変更（既存の 60 秒 TTL を維持）
- Header の動的部分のさらなる分割（プロフィールアバターなど）
- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) への PPR 適用（別タスク）
- Lighthouse / Vercel Analytics での実数比較（Vercel preview デプロイ後に別途実施）
- Next.js を canary 系にアップグレードする検討（バージョン管理ポリシー上、別タスクとして扱う）

## 前提・制約

- `app/(site)/layout.tsx` は Server Component のままとする（PPR は Server Component を前提とする）
- `app/(site)/page.tsx` の auth 取得（`supabase.auth.getUser()`）は引き続き必要（ログインボタン表示分岐のため）
- `getHomeImagesInitial()` は `unstable_cache` で 60 秒キャッシュされており、`cookies()` を呼ばないため Suspense 内部で素直に await できる
- 認証情報依存のコンポーネントは `cookies()` を呼ぶため動的扱いになる。これらは Suspense 境界の **内側** に隔離する
