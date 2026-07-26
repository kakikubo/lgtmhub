# design.md

## 全体方針

Issue #128 は「投稿者情報の表示場所を変えるだけ」ではなく、**一覧画面に投稿者情報を取得・受け渡す経路を全て削除する** ことで、N+1 防止のために積み上げてきた `findManyByIds` 経由のロジック (#98/#102/#126) を一気にシンプル化する。

代わりに、画像詳細ページ (1 件のみ) では `UserProfileService.findById` を 1 回追加で呼ぶだけにする。N+1 にならないため、シンプルで十分。

## 変更対象ファイル

### 削除 / 簡素化 (一覧側)

| ファイル | 変更内容 |
|---|---|
| `components/image-card.tsx` | 投稿者アバターブロック / `profile` props を削除。`Image`/`Link` のうち画像本体と CopyMarkdownButton のみ残す |
| `components/image-grid.tsx` | `profiles` props を削除。`ImageCard` への受け渡しも削除 |
| `components/home-images.tsx` | `initialProfiles` / `randomProfiles` / `profileMap` を削除。`randomImagesResponseSchema` の `profiles` も同時に削除されるため、`json.profiles` を読まない形へ更新 |
| `components/load-more-button.tsx` | `profiles` state を削除。`json.profiles` を読まない |
| `components/home-content.tsx` | `fetchUploaderProfiles` 関数と `initialProfiles` props 受け渡しを削除 |
| `app/api/images/route.ts` | `buildUserProfileService` 呼び出しと `profiles` 同梱を削除 |
| `app/api/images/random/route.ts` | 同上 |
| `src/lib/validation/image.ts` | `listImagesResponseSchema` / `randomImagesResponseSchema` から `profiles` を削除。`userProfileResponseSchema` / `UserProfileResponse` 型もインポートが消えるため削除 |

### 追加 (詳細ページ側)

| ファイル | 変更内容 |
|---|---|
| `app/(site)/images/[id]/page.tsx` | `image.uploaderId` を使って `UserProfileService.findById` を呼び、`UploaderProfileRow` (新規) で投稿者行を描画する |

### 新規

| ファイル | 役割 |
|---|---|
| `components/uploader-profile-row.tsx` | 投稿者行 (`投稿者： アバター 表示名 (link)`) を描画する Server Component。`resolveUploaderDisplay` を内部で呼び出して fallback を意識せず使える API にする |

## 詳細設計

### `components/uploader-profile-row.tsx`

```tsx
import Image from 'next/image';
import {
  DEFAULT_AVATAR_PATH,
  resolveUploaderDisplay,
} from '@/src/lib/profile/resolve-uploader-display';
import type { UserProfile } from '@/src/types/user';

export function UploaderProfileRow({ profile }: { profile: UserProfile | null }) {
  const uploader = resolveUploaderDisplay(profile ?? undefined);
  const avatar = (
    <Image
      src={uploader.avatarUrl}
      alt=""
      width={24}
      height={24}
      sizes="24px"
      className="rounded-full bg-gray-100"
      unoptimized
    />
  );
  const nameNode = uploader.profileUrl ? (
    <a
      href={uploader.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-gray-900 underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
    >
      {uploader.displayName}
    </a>
  ) : (
    <span className="text-sm text-gray-600">{uploader.displayName}</span>
  );

  return (
    <div
      data-testid="image-detail-uploader"
      data-fallback={uploader.isFallback ? 'true' : 'false'}
      className="flex items-center gap-2 text-sm"
    >
      <span className="text-gray-600">投稿者：</span>
      {avatar}
      {nameNode}
    </div>
  );
}
```

- `profile` を `null` 許容にすることで、`findById` の戻り値 (`UserProfile | null`) をそのまま渡せる
- 内部で `resolveUploaderDisplay` を呼ぶことで「fallback 判定の責務を呼び出し側に漏らさない」設計
- `data-testid="image-detail-uploader"` / `data-fallback` を付与し、E2E で fallback 分岐を検証できるようにする (一覧側の `image-card-uploader` と同じ命名規則)
- `DEFAULT_AVATAR_PATH` を直接インポートしない (resolveUploaderDisplay の戻り値経由で取得済み)。`import` は `resolveUploaderDisplay` のみで完結する

### `app/(site)/images/[id]/page.tsx`

```ts
const [imageResult, userResult] = await Promise.all([
  buildImageService(supabase).getImage(id).catch(...),
  supabase.auth.getUser(),
]);

if (!imageResult) notFound();

// 画像取得後でないと uploaderId が分からないため逐次。
// 詳細ページは 1 件のみのため findById で十分 (N+1 を回避するための findManyByIds は不要)。
// プロフィール取得に失敗してもページは表示し続け、UploaderProfileRow 側で Unknown フォールバック。
const uploader = await buildUserProfileService(supabase)
  .findById(imageResult.uploaderId)
  .catch((err: unknown) => {
    console.error('[ImageDetailPage] failed to load uploader profile', err);
    return null;
  });
```

- `DetailView` の引数に `uploader: UserProfile | null` を追加し、画像 (`<Image>`) と `CopyMarkdownButton` の間に `<UploaderProfileRow profile={uploader} />` を差し込む
- 配置順:
  1. 「← 一覧に戻る」リンク
  2. LGTM 画像
  3. **投稿者行 (新規)**
  4. CopyMarkdownButton
  5. (owner のみ) ImageDetailActions

### 一覧側 (削除作業) の段取り

依存方向に従って「下流 → 上流」の順で削る。

1. **`ImageCard`**: profile を持たない最小実装に戻す
2. **`ImageGrid`**: profiles props を削除
3. **`LoadMoreButton`**: profiles state を削除 (`ImageGrid` から profiles を受け取らなくなる)
4. **`HomeImages`**: initialProfiles / randomProfiles を削除
5. **`home-content.tsx`**: `fetchUploaderProfiles` 関数を削除
6. **API ルート**: `buildUserProfileService` 呼び出しを削除
7. **バリデーションスキーマ**: `profiles` フィールドを削除 (これで `UserProfileResponse` / `userProfileResponseSchema` の参照がゼロになるため、型/定数も削除)

### テスト更新の方針

- **`tests/unit/api/images/list-route.test.ts` / `random-route.test.ts`**:
  - `buildUserProfileService` モックと profile 関連のアサーションを削除
  - 「成功時 profiles を同梱」「profiles 取得失敗時 degrade」のテストを削除
  - 通常の成功ケース (200 を返し `images` を含む) と 500 ケースのみ残す
- **`tests/unit/lib/validation/image.test.ts`**:
  - `listImagesResponseSchema` / `randomImagesResponseSchema` の `profiles` 関連テストを削除
  - 「profile の必須フィールド」「profiles が欠ける」系を削除
  - スキーマが受理する入力例を `profiles` 抜きへ更新
- **`tests/e2e/image-list.test.ts`**:
  - Issue #98 由来の「各カードに投稿者プロフィール行が表示される」テストを削除
  - Issue #102 由来の「profile 有のとき GitHub リンクになる」/「fallback はリンクにならない」テストを削除
  - 残りの SSR / 404 / ランダム表示テストはそのまま
- **`tests/e2e/image-detail.test.ts`**:
  - 既存の遷移テスト / 404 テストはそのまま
  - 新規テスト: 「詳細ページに投稿者行が表示される」「`Unknown` フォールバックでもリンクは張られない」を追加 (image-list と同じく「データ有無に依存しない」パターン)

## 採用しなかった案

### 案 A: 詳細ページでも `findManyByIds([uploaderId])` を使う

- メリット: 一覧側と同じ呼び出し方で揃う
- デメリット: 1 件のために重複排除や配列処理が走るのは冗長
- → 詳細ページは 1 件確定なので `findById` を採用

### 案 B: 詳細ページの `Promise.all` に profile 取得を組み込む

- `image` の前に `uploaderId` を知る術がないため不可。逐次にする以外ない

### 案 C: `profiles` フィールドをスキーマに残し、API 側だけ空配列を返す

- メリット: 破壊的変更を回避できる
- デメリット: 未使用のフィールドを長期間 schema/ レスポンスに残すと「なぜここにあるのか」が分からなくなる
- → 同 PR で全消費側を更新できるため、思い切って削除する (CLAUDE.md「シンプル第一 / 影響するコードを最小限にする」原則)
