# design.md

## 全体方針

1. **Server Component で 1 回だけ取得**: `HomeContent` の `Promise.all` ブロックに `buildUserProfileService(supabase).findManyByIds(...)` を含め、TTFB を保ったまま並列化する。失敗時は `[]` にフォールバックして graceful degrade させる (画像一覧自体の表示は壊れない)。
2. **plain object で props 渡し**: `ImageGrid` / `ImageCard` には `Map<string, UserProfile>` ではなく、各カードに必要な `UserProfile | undefined` (またはそれを解決した小さい view model) を渡す。Server → Client の serialization 境界に `Map` を置かない (Server Component → Server Component なら `Map` のままでも動くが、将来 Client 化したときに困らないようにする)。
3. **フォールバックロジックは純関数化**: 「`profile` がある / 無い」を判定して `{ displayName, avatarUrl, isFallback }` を返す関数を `src/lib/profile/resolve-uploader-display.ts` に切り出す。これを Vitest でユニットテストする (RTL を新規導入しない、ガイドライン「ユニットは `src/lib/` と `src/services/`」遵守)。
4. **デフォルトアバターは SVG**: `public/default-avatar.svg` を追加。グレー円 + 中央に人型シルエット。ライセンスフリーで小さく軽量。next/image で扱えるよう拡張子付き静的ファイルとする。
5. **`findManyByIds` 呼び出しは `HomeContent` のみ**: `LoadMoreButton` 経由の追加読み込みは本 PR スコープ外。`load-more-button.tsx` に投稿者解決を追加すると LoadMore 経由でも Server Action 内で `findManyByIds` を呼ぶ必要があり関心事が広がる。先頭ページ初期表示の投稿者表示のみを対象 (ガイドラインに「LoadMore は別 PR」と申し送り)。

## ファイル変更

### 新規

- `src/lib/profile/resolve-uploader-display.ts` (純関数とフォールバック定数)
- `tests/unit/lib/profile/resolve-uploader-display.test.ts` (ユニットテスト)
- `public/default-avatar.svg` (フォールバック用 SVG)

### 修正

- `components/home-content.tsx`
  - `Promise.all` に `findManyByIds` 呼び出しを追加 (画像取得結果を待ってから呼ぶ必要があるため、二段構えにする)
  - 失敗時は `[]` にフォールバック
  - `Map<string, UserProfile>` を構築して `ImageGrid` に渡す
- `components/image-grid.tsx`
  - `profiles: Map<string, UserProfile>` を追加 (undefined 可)
  - `ImageCard` に `profile={profiles?.get(image.uploaderId)}` を渡す
- `components/image-card.tsx`
  - `profile?: UserProfile` を props に追加
  - `resolveUploaderDisplay(profile)` で表示情報を作る
  - 既存 `<Link>` + `<CopyMarkdownButton>` の **上** に投稿者行を配置 (Issue 図示なし、自然な順序として「投稿者 → 画像 → コピーボタン」)
  - アバターは next/image (24×24, sizes 固定, unoptimized は不要だが GitHub avatar は外部 URL なので `unoptimized` を踏襲) で表示
- `docs/development-guidelines.md`
  - 「画像一覧で投稿者プロフィールを表示する場合は `findManyByIds` を 1 回のみ呼ぶ」項目を追記
- `tests/e2e/image-list.test.ts`
  - 既存のシード画像に対応する uploader 表示の検証を追加

## API 設計

### `resolveUploaderDisplay`

```ts
import type { UserProfile } from '@/src/types/user';

export const UNKNOWN_UPLOADER_NAME = 'Unknown';
export const DEFAULT_AVATAR_PATH = '/default-avatar.svg';

export interface UploaderDisplay {
  displayName: string;
  avatarUrl: string;
  isFallback: boolean;
}

/**
 * 画像カードに表示する投稿者プレゼンテーション情報を解決する。
 * `profile` が `undefined` の場合 (GitHub 連携解除後など) は `Unknown` + デフォルトアバターを返す。
 */
export function resolveUploaderDisplay(profile: UserProfile | undefined): UploaderDisplay {
  if (!profile) {
    return {
      displayName: UNKNOWN_UPLOADER_NAME,
      avatarUrl: DEFAULT_AVATAR_PATH,
      isFallback: true,
    };
  }
  return {
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isFallback: false,
  };
}
```

### `HomeContent` の変更後フロー

```ts
const [userResult, imagesResult] = await Promise.all([
  supabase.auth.getUser(),
  getHomeImagesInitial().catch(/* graceful degrade */),
]);

const images: PublicLgtmImage[] = imagesResult?.images ?? [];

// 画像取得結果に依存するため Promise.all 第2段
const uploaderIds = images.map((i) => i.uploaderId);
const profiles = uploaderIds.length === 0
  ? []
  : await buildUserProfileService(supabase)
      .findManyByIds(uploaderIds)
      .catch((err) => {
        console.error('[HomePage] failed to fetch uploader profiles', err);
        return [];
      });
const profileMap = new Map(profiles.map((p) => [p.id, p]));
```

`profileMap` を `ImageGrid` に props として渡す。

### `ImageGrid` (シグネチャ拡張)

```ts
interface ImageGridProps {
  images: PublicLgtmImage[];
  profiles?: Map<string, UserProfile>;
  testId?: string;
}
```

`profiles` は optional とし、未指定なら全画像が `Unknown` フォールバックになる (LoadMore 経由など、将来別系統で使う場合の安全側デフォルト)。

### `ImageCard` (シグネチャ拡張)

```ts
export function ImageCard({
  image,
  profile,
  priority = false,
}: {
  image: PublicLgtmImage;
  profile?: UserProfile;
  priority?: boolean;
}) { ... }
```

DOM 構造 (投稿者行を追加):

```tsx
<article className="space-y-2">
  <div data-testid="image-card-uploader" className="flex items-center gap-2">
    <Image
      src={display.avatarUrl}
      alt={display.displayName}
      width={24}
      height={24}
      className="rounded-full bg-gray-100"
      unoptimized
    />
    <span className="text-sm text-gray-700 truncate">{display.displayName}</span>
  </div>
  <Link ...>...</Link>
  <CopyMarkdownButton ... />
</article>
```

## デフォルトアバター SVG

`public/default-avatar.svg`:
- 24×24 viewBox
- 背景: `#e5e7eb` (gray-200) の円
- 中央: 人型シルエット (`#9ca3af` gray-400)
- インライン化せず静的ファイル (Cache-Control によりブラウザキャッシュされ、LCP を阻害しない)

## docs/development-guidelines.md 更新

「N+1 防止」もしくは「Server Component でのデータ取得」の節に以下を追記:

> 画像一覧 (`HomeContent` 等) で投稿者プロフィールを表示する場合は、`UserProfileService.findManyByIds(uploaderIds)` をリクエスト内で **1 回のみ呼ぶ**。`ImageCard` ごとに `findById` を呼んではならない。取得結果は `Map<string, UserProfile>` に変換して各カードへ plain object として渡す。

## テスト戦略

### ユニット (`tests/unit/lib/profile/resolve-uploader-display.test.ts`)

- `profile` が `undefined` のとき `Unknown` + `/default-avatar.svg` + `isFallback: true`
- `profile` が与えられたとき `displayName` / `avatarUrl` がそのまま透過し `isFallback: false`
- `UNKNOWN_UPLOADER_NAME` / `DEFAULT_AVATAR_PATH` の export 値も併せて確認

### E2E (`tests/e2e/image-list.test.ts`)

- 画像グリッドが表示された状態で、各カード内に `data-testid="image-card-uploader"` が存在
- 少なくとも 1 枚のカードで投稿者名 (固定 seed のテストユーザー名) が描画されていることを確認

### コンポーネントレベルのレンダリングテストについて

現状のテストインフラ (Vitest + node 環境) は `src/lib/` / `src/services/` の純粋ロジックを対象としている。React Testing Library + jsdom の新規導入はスコープが過大になるため、本 PR では行わない。ImageCard の挙動は (1) 純関数 `resolveUploaderDisplay` のユニットテスト、(2) E2E で総合的に担保する。
