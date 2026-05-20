# 設計 (Issue #126)

## 基本方針

Issue #120 (commit `4d18fb0`) の修正と完全に同じパターンを `GET /api/images/random` 側にも適用する。

「もっと読み込む」と「ランダム表示」は、どちらも

> クライアントが追加で画像を fetch し、`ImageGrid` で描画するが、`profiles` Map を持たないため Unknown へ degrade してしまう

という同一の構造的問題を抱えており、解決策も同型なので意図的に対称な実装にする。

## 変更点

### 1. `src/lib/validation/image.ts`

`randomImagesResponseSchema` に `profiles` を追加する。`userProfileResponseSchema` は Issue #120 ですでに導入済みなので再利用する。

```ts
export const randomImagesResponseSchema = z.object({
  images: z.array(imageListItemSchema),
  // 投稿者の重複排除済みプロフィール一覧。取得失敗時はサーバー側で [] に degrade する。
  profiles: z.array(userProfileResponseSchema),
});
```

### 2. `app/api/images/random/route.ts`

`GET /api/images` と同じく、`listRandomImages` のあとに `buildUserProfileService(supabase).findManyByIds([...uploaderIds])` を呼び、profiles をレスポンスに同梱する。失敗時は `[]` に degrade する。

```ts
const result = await service.listRandomImages();
const profiles = await buildUserProfileService(supabase)
  .findManyByIds(result.images.map((image) => image.uploaderId))
  .catch((err: unknown) => {
    console.error('[GET /api/images/random] failed to fetch uploader profiles', err);
    return [];
  });
return NextResponse.json({ ...result, profiles }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
```

### 3. `components/home-images.tsx`

クライアントが受け取った `profiles` を `Map<string, UserProfile>` に復元し、ランダムモードの `ImageGrid` に渡す。

```ts
const [randomImages, setRandomImages] = useState<PublicLgtmImage[]>([]);
const [randomProfiles, setRandomProfiles] = useState<Map<string, UserProfile>>(new Map());
// ...
const json = randomImagesResponseSchema.parse(await res.json());
const restoredProfiles: UserProfile[] = json.profiles.map((p) => ({
  id: p.id,
  githubLogin: p.githubLogin,
  displayName: p.displayName,
  avatarUrl: p.avatarUrl,
  isAdmin: p.isAdmin,
  createdAt: new Date(p.createdAt),
  updatedAt: new Date(p.updatedAt),
}));
setRandomImages(images);
setRandomProfiles(new Map(restoredProfiles.map((profile) => [profile.id, profile])));
setMode('random');
```

ランダムモードの描画:

```tsx
<ImageGrid images={randomImages} profiles={randomProfiles} />
```

「再押下するとシャッフルし直す」要件 (Issue #109) を満たすため、ランダム結果は配列・Map ともに **マージではなく上書き** にする (LoadMoreButton と異なる点)。

## テスト戦略

### ユニット

- `tests/unit/lib/validation/image.test.ts`
  - `randomImagesResponseSchema` に `profiles` が追加されたことを検証 (受理 / 必須 / 各 profile の必須フィールド)。
- `tests/unit/api/images/random-route.test.ts` (新規)
  - 成功時 profiles 同梱
  - profile 取得失敗時の degrade
  - listRandomImages 失敗時の 500
  - `list-route.test.ts` のパターンを忠実に再現

### E2E

既存の Issue #109 E2E (`tests/e2e/image-list.test.ts` の `画像一覧画面 ランダム表示`) はモード切替と「もっと読み込む」非表示のみを検証している。プロフィール表示は seed 依存で flaky になりやすく、Issue #120 でも E2E は追加していない (route ユニットテストで保証する) ため同じ方針を踏襲する。

## 影響範囲

- API レスポンス: `GET /api/images/random` に `profiles` フィールドが追加される。クライアントは zod の `.object()` (= 既知キー以外を捨てる) で parse しているため、古いクライアントとは後方互換 (既知の `images` のみ使う)。
- 既存の E2E は変更不要 (data-testid / data-mode 等の DOM 構造は不変)。

## ロールバック

スキーマと route の差分を revert すれば良い (HomeImages の差分も連動して revert する)。データ層には変更が無いため安全。
