# 設計: トップページ PPR 適用検討と Suspense 境界導入

## アプローチ概要

PPR の前提条件である **Suspense 境界の導入** を主軸とし、PPR 自体は環境チェック付きで「試行 → 失敗時は revert」の二段構えで進める。Suspense 境界導入は PPR とは独立して TTFB / HTML ストリーミングを改善するため、PPR が現環境で動かなくても価値を生む。

## 設計判断

### 1. なぜ「page.tsx の認証ロジック分離」が必要か

現在の `app/(site)/page.tsx` は `HomePage` 自体が `async` 関数で `await supabase.auth.getUser()` している。これを Suspense で囲んでも、Suspense fallback はあくまで **「Suspense の child が pending の間」** にしか発火しない。`HomePage` 全体を Suspense で囲んでも、`HomePage` の親（`layout.tsx`）から見ると child が即時 fallback で resolve するか await するかの違いに過ぎず、page.tsx 内部での **静的シェル + 動的セクション** の分割が起きない。

PPR で静的シェルを得るには、`HomePage` 自体を **同期 Server Component** にし、auth 取得・画像取得を **child の async Server Component** に移して Suspense で囲む必要がある。

### 2. 並列化の効果

現状:

```
HomePage (await auth) → (await images) → render
                       ┃ 直列
```

改修後:

```
HomePage (sync) → ┬── <Suspense><HomeAuthSection (await auth)/></Suspense>
                  └── <Suspense><ImageListSection (await images)/></Suspense>
```

React は両方の async child を同時に kick off するため、auth 取得と画像取得が並列実行される。

加えて `<Suspense fallback>` を返す HTML は即座にクライアントへ送出され、後から RSC payload で resolve した content がストリーミング差し替えされる。

### 3. PPR 設定の試行戦略

`next@15.5.x` stable で `experimental.ppr` を有効化すると、`next build` が以下のようなエラーを吐く可能性がある:

```
Error: Partial Prerendering (PPR) is an experimental feature. To use it, you need to be on the next@canary version of Next.js.
```

このため、**まずは PPR 設定なしで Suspense 境界のみ導入** し、その時点でビルドが通ることを確認する。次に PPR 設定を加えてビルドを試行し、成功すれば残し、失敗すれば revert する。これにより本流の改善（Suspense 境界）が PPR の成否に巻き込まれない。

## 変更ファイル一覧

| ファイル | 変更内容 |
|----------|----------|
| `components/header.tsx` | 既存の async `Header` を `HeaderContent` に rename。`HeaderShell` (静的部分: 枠 + ロゴ) と `HeaderActions` (auth 依存部分) に分割可能な形にする — ただし最小変更として **既存 Header をそのまま `<Suspense>` で囲むだけ** とし、内部分割は行わない |
| `components/header-skeleton.tsx` | **新規** Header の高さを保つための skeleton コンポーネント |
| `app/(site)/layout.tsx` | `<Header />` を `<Suspense fallback={<HeaderSkeleton/>}><Header/></Suspense>` で囲む |
| `components/image-grid-skeleton.tsx` | **新規** ImageGrid のグリッド寸法を保つ skeleton |
| `components/home-content.tsx` | **新規** HomePage の動的セクション（auth 依存 + 画像取得 + エラー/空状態の分岐）を子 Server Component として実装 |
| `app/(site)/page.tsx` | 同期 Server Component に変更し、子セクションを Suspense で囲む。`experimental_ppr` の export は **PPR ビルドが成功した場合のみ** 残す |
| `next.config.ts` | `experimental.ppr: 'incremental'` の追加を試行。失敗時は revert |

## 詳細設計

### 1. `components/header-skeleton.tsx` (新規)

Header と同じ高さ・横幅の枠だけを表示する。子要素は具体的な avatar / button まで含めず、レイアウトシフトを抑える程度の placeholder のみ。

```tsx
export function HeaderSkeleton() {
  return (
    <header className="border-b" aria-hidden>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <span className="text-lg font-semibold">LGTMHub</span>
        <div className="h-8 w-24" />
      </div>
    </header>
  );
}
```

Header の実体（`components/header.tsx`）は `<header>` を返し `py-3` `text-lg` を使っているため、同じパディング・ロゴテキストを持つ skeleton で高さを揃える。

### 2. `components/image-grid-skeleton.tsx` (新規)

ImageGrid と同じグリッド構成（`grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4`）で 8 個のプレースホルダー（`aspect-[4/3]`）を表示する。

```tsx
const SKELETON_COUNT = 8;

export function ImageGridSkeleton() {
  return (
    <ul
      data-testid="image-grid-skeleton"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
      aria-hidden
    >
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <li key={i} className="space-y-2">
          <div className="relative aspect-[4/3] rounded border bg-gray-100" />
          <div className="h-8 rounded bg-gray-100" />
        </li>
      ))}
    </ul>
  );
}
```

`ImageCard` は `<article>` 内で画像 + `<CopyMarkdownButton />` (高さ ~32px) を縦並びにしているため、skeleton も `space-y-2` + ボタン領域を含める。

### 3. `components/home-content.tsx` (新規)

`HomePage` から動的処理（auth + 画像取得 + 分岐）を切り出した async Server Component。

```tsx
import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { signInWithGithub } from '@/src/lib/auth/actions';
import { getHomeImagesInitial } from '@/src/lib/cache/list-home-images';
import { createClient } from '@/src/lib/supabase/server';
import type { PublicLgtmImage } from '@/src/types/image';

function EmptyState({ isLoggedIn }: { isLoggedIn: boolean }) {
  // 既存の page.tsx から移設
}

function LoadErrorState() {
  // 既存の page.tsx から移設
}

export async function HomeContent() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let images: PublicLgtmImage[] = [];
  let nextCursor: string | null = null;
  let loadError = false;
  try {
    const result = await getHomeImagesInitial();
    images = result.images;
    nextCursor = result.nextCursor;
  } catch (err) {
    console.error('[HomePage] failed to list images', err);
    loadError = true;
  }

  return (
    <>
      {user ? null : (
        <p className="text-sm text-gray-600">
          画像の閲覧とマークダウンのコピーはログイン不要です。 画像を登録するには GitHub でログインしてください。
        </p>
      )}

      {loadError ? (
        <LoadErrorState />
      ) : images.length === 0 ? (
        <EmptyState isLoggedIn={!!user} />
      ) : (
        <>
          <ImageGrid images={images} />
          {nextCursor ? <LoadMoreButton initialCursor={nextCursor} /> : null}
        </>
      )}

      {user ? null : (
        <form action={signInWithGithub}>
          <button
            type="submit"
            className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700"
          >
            ログインして登録
          </button>
        </form>
      )}
    </>
  );
}
```

> **設計判断**: auth 取得と画像取得を **同じ async Server Component** にまとめる。理由は (a) 一覧の表示分岐 (空状態 / ログイン CTA / ログイン済み導線) が両方の値に依存するため、片方だけ切り出すと props 渡しの間接化が増える、(b) Suspense 境界が 1 個に収まり実装と挙動の追跡がシンプル、(c) `unstable_cache` ヒット時は images の await はマイクロタスク 1 周で resolve するので、auth 取得とマージしてもオーバーヘッドが無視できる。

### 4. `app/(site)/page.tsx`

同期 Server Component に変更。Suspense を使って `HomeContent` を囲む。`<h1>` 等のページ骨格は静的シェルに残る。

```tsx
import { Suspense } from 'react';
import { HomeContent } from '@/components/home-content';
import { ImageGridSkeleton } from '@/components/image-grid-skeleton';

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">LGTM 画像一覧</h1>
      </header>
      <Suspense fallback={<ImageGridSkeleton />}>
        <HomeContent />
      </Suspense>
    </section>
  );
}
```

### 5. `app/(site)/layout.tsx`

Header を Suspense で囲む。

```tsx
import { Suspense } from 'react';
import { Header } from '@/components/header';
import { HeaderSkeleton } from '@/components/header-skeleton';

export default function SiteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col">
      <Suspense fallback={<HeaderSkeleton />}>
        <Header />
      </Suspense>
      <main className="flex-1">{children}</main>
    </div>
  );
}
```

### 6. `next.config.ts` の PPR 試行

最初は触らず、Suspense 化が落ち着いた段階で以下を追加してビルドを試す:

```ts
const nextConfig: NextConfig = {
  // 既存設定...
  experimental: {
    ppr: 'incremental',
  },
};
```

加えて `app/(site)/page.tsx` に `export const experimental_ppr = true;` を追加。

`npm run build` が成功すれば残す。失敗（`Partial Prerendering ... only available on canary` 等）が出たら **両方の編集を revert** する。

## アーキテクチャへの影響

- レイヤー分離の方針（Presentation → Service）は変わらない。Service Layer (`buildImageService`) と Repository Layer は無変更
- `unstable_cache` の挙動・タグ (`HOME_IMAGES_CACHE_TAG`) は変更しない
- E2E テストは画像一覧の testid (`image-grid`, `image-list-empty`, `image-list-error`) を使っており、これらは `HomeContent` 内で維持されるため互換

## テスト戦略

### 既存テスト互換

- `tests/e2e/image-list.test.ts` の `data-testid="image-grid"` 等のセレクタはそのまま機能する（HomeContent が同じ DOM を出すため）
- `tests/e2e/auth-callback.test.ts` のリダイレクト後の Header 表示確認も Suspense fallback → Header content の流れで成立する。Playwright の `expect(...).toBeVisible()` は CSC 的な hydrate を待つため fallback の存在は気にせず動作する見込み

### 追加テスト

- **追加しない**。Skeleton コンポーネントは見た目のみで状態を持たず、Server Component の単純なラップのため、E2E で観測される最終 DOM が変わらない
- ただし PPR 動作を担保するためのアサーションは Vercel preview 段階で Lighthouse / DevTools MCP で検証する（今回スコープ外）

## 既知のリスク / 代替案検討

### リスク 1: Suspense fallback が原因で initial render に flash が起きる

`unstable_cache` ヒット時は images 取得は数 ms 程度なので、fallback (`ImageGridSkeleton`) が一瞬だけ見えてからすぐ実体に置き換わる。これは **HTML ストリーミングの仕様上避けられず**、現状のブロッキングレンダリング（白画面）よりも UX 的に優位（コンテンツが段階的に出る）。Skeleton の見た目を最終 DOM に近づけることでこの flash を最小化する。

### リスク 2: PPR 有効化で既存 ISR / `revalidateTag` の挙動が変わる

PPR は `unstable_cache` / `cacheTag` / `revalidateTag` と互換性があると公式に明記されている。投稿/削除時の `revalidateTag(HOME_IMAGES_CACHE_TAG)` は引き続き機能する。ただし PPR 有効時は **動的境界の再評価** だけが行われ、静的シェル部分は再生成されない（変更がないため問題なし）。

### リスク 3: PPR が次のビルドで動かない

→ 二段構えで対応（Suspense 化のみ採用 → 後続 PR で再挑戦）。

### 代替案検討: HomePage 全体を `<Suspense>` で囲む

これは layout.tsx の `<main>` 配下を Suspense で囲むのと同義。h1 タイトルすら fallback 中は出ないため UX が劣化する。**棄却**。

### 代替案検討: auth と画像取得を別 Suspense にする

理論的には並列化が更に細分化される。だが (a) 表示分岐が両方の結果に依存しているため再構成コストが大きい、(b) PPR / Suspense の効果は「動的境界をまとめて切り出す」段階で十分得られる、ため初手では採用しない。**Phase 2 で再検討余地**。
