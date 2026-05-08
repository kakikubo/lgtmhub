# 設計: ホームページの auth/画像取得を並列化

## 変更対象

- `components/home-content.tsx` (唯一の変更ファイル想定)

## 現状コード (要点)

```tsx
export async function HomeContent() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();   // ← 直列 1

  let images: PublicLgtmImage[] = [];
  let nextCursor: string | null = null;
  let loadError = false;
  try {
    const result = await getHomeImagesInitial();              // ← 直列 2
    images = result.images;
    nextCursor = result.nextCursor;
  } catch (err) {
    console.error('[HomePage] failed to list images', err);
    loadError = true;
  }
  // ...
}
```

## 変更後コード (案)

`app/(site)/images/[id]/page.tsx:60` の既存パターンに揃える。

```tsx
export async function HomeContent() {
  const supabase = await createClient();

  // auth と画像取得は独立しているため Promise.all で並列化し TTFB を短縮する。
  // 画像取得失敗時は graceful degrade (LoadErrorState 表示) を維持するため個別に catch する。
  const [userResult, imagesResult] = await Promise.all([
    supabase.auth.getUser(),
    getHomeImagesInitial().catch((err: unknown) => {
      console.error('[HomePage] failed to list images', err);
      return null;
    }),
  ]);

  const user = userResult.data.user;
  const images = imagesResult?.images ?? [];
  const nextCursor = imagesResult?.nextCursor ?? null;
  const loadError = imagesResult === null;

  return (
    /* JSX 変更なし */
  );
}
```

## 設計判断

### `Promise.all` vs `Promise.allSettled`

`Promise.all` を採用する。理由:

- `auth.getUser()` は Supabase SSR 仕様上ネットワーク失敗を error として握りつぶし、`{ data: { user: null } }` を返す(throw しない)
- 画像取得側は個別 `.catch` で `null` に倒す → `Promise.all` 全体が reject されない
- 既存の詳細ページ (`app/(site)/images/[id]/page.tsx`) と実装スタイルを統一できる

### `null` 由来の `loadError` 判定

- `imagesResult === null` を `loadError` の単独シグナルとする
- `getHomeImagesInitial()` が成功した場合は `null` を返さない (型は `Promise<ListImagesResult>`) ため、`null` ⇔ catch 経由で fallthrough したことが一意に決まる

### `createClient()` の位置

- `await createClient()` は cookies() に依存するため、`Promise.all` の前で呼ぶ必要がある
- これは詳細ページのパターンと同じ

## 影響範囲

- ロジックの semantics は完全互換 (success / error / empty 各分岐の出力は変わらない)
- JSX 部分は無変更
- 型: 既存の `PublicLgtmImage[]`, `string | null`, `boolean` の3変数のまま

## 計測 (任意 / Issue 完了条件のため)

ローカル `npm run build && npm run start` でホームに 3 回連続アクセス:

- Before: ログから `console.time('auth')` / `console.time('images')` の wall-clock を確認(直列で T_auth + T_images)
- After: 並列化後は max(T_auth, T_images) になることを確認

本番計測 (TTFB / LCP) は Vercel preview / production deploy 後に Chrome DevTools MCP で実施する想定。本タスク内では必須としない。

## テスト戦略

- 既存ユニットテスト: `home-content.tsx` 自体には専用ユニットテストが存在しない (Server Component かつ JSX 出力のみのため)
- 既存 E2E: `tests/e2e/image-list.test.ts` で画像一覧の表示を検証済み → リグレッション検出に活用
- 新規テスト: 不要(Server Component の挙動はロジック互換であり、E2E でカバー済み)

## ロールバック計画

`Promise.all` で予期せぬエラーが発生した場合の即時退避:

- `git revert` で 1 コミット戻す (1 ファイルの差分のみのため安全)
- もしくは元の直列コードに戻す
