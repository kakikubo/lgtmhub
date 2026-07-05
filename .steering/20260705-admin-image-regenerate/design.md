# Design — 管理者限定 LGTM 画像再生成

## 1. コンポーネント一覧

| レイヤー | パス | 追加 / 変更 | 役割 |
|---------|------|------------|------|
| Presentation | `app/(site)/images/[id]/page.tsx` | 変更 | 現在のユーザーの `is_admin` を取得し、`ImageRegenerateAction` を条件付き描画 |
| Presentation | `components/image-regenerate-action.tsx` | 新規 | 管理者向け再生成ダイアログ (`'use client'`, AlertDialog + input) |
| API | `app/api/images/[id]/regenerate/route.ts` | 新規 | `POST` 実装。認証 + `requireAdmin` + zod + service 呼び出し + revalidateTag |
| Service | `src/services/image-service.ts` | 変更 | `regenerateImage()` を追加。`createImage()` と共通の内部フロー helper を抽出 |
| Repository | `src/repositories/image-repository.ts` | 変更 | `listActivePHashesExcept(excludeId)` と `updateAfterRegenerate(id, patch)` を追加 |
| Auth util | `src/lib/auth/require-admin.ts` | 新規 | `requireAdmin(supabase)` — 認証 + is_admin 判定 |
| Errors | `src/lib/errors.ts` | 変更なし | `ForbiddenError` / `NotFoundError` / `DuplicateImageError` / `BadRequestError` を再利用 |
| Validation | `src/lib/validation/image.ts` | 変更 | `regenerateImageRequestSchema` / `regenerateImageResponseSchema` を追加 |
| Tests | `tests/unit/**` | 新規 | require-admin, image-service.regenerateImage, api regenerate-route, image-regenerate-action の unit テスト |

## 2. `requireAdmin` ヘルパー

`src/lib/auth/require-admin.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { ForbiddenError, UnauthorizedError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';

export interface AdminContext {
  userId: string;
}

/**
 * 認証 + is_admin=true を要求する共通ゲート。
 * - 未ログイン: UnauthorizedError
 * - 認証済みだが is_admin=false または row 欠損: ForbiddenError
 *
 * 呼び出し側 (Route Handler) は catch で 401 / 403 に変換する。
 * 将来の管理者機能 (PRD 機能6) で共有する。
 */
export async function requireAdmin(
  supabase: SupabaseClient<Database>,
): Promise<AdminContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new UnauthorizedError();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw new ForbiddenError();
  if (!data || data.is_admin !== true) throw new ForbiddenError();
  return { userId: user.id };
}
```

意図:
- 依存を `SupabaseClient<Database>` に絞り、`createClient()` の呼び出しは Route Handler 側の責務にする (テスト時のモックが容易)。
- `is_admin` 判定失敗 (RLS で SELECT できない、row が無い等) はすべて `ForbiddenError` に倒す。理由は「管理者かどうかを識別できないなら管理者ではない」と扱うため。

## 3. Service 層設計

### 3.1 `createImage` の共通処理を helper に抽出

`buildLgtmVariant(sourceUrl, options)` プライベート helper を切り出す:

```ts
interface BuildLgtmVariantOptions {
  excludeImageId?: string;   // 自己衝突除外
}
interface BuildLgtmVariantResult {
  blobKey: string;
  blobUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  isAnimated: boolean;
}

// 内部処理: safeFetch → validateImage → calculatePHash → 重複判定 → composeLgtmImage → blob.put
// - 重複判定は excludeImageId を除外
// - 失敗時: blob put 済みなら best-effort del
```

- `createImage` 内で使い、`regenerateImage` からも使う。
- **DailyLimit** と **DB write** は helper の外で呼ぶ。行動 (制限計上・INSERT / UPDATE) は helper に持ち込まない。

### 3.2 `regenerateImage`

```ts
async regenerateImage(
  imageId: string,
  requesterId: string,
  overrideUrl: string | undefined,
): Promise<LgtmImage>
```

処理順序:

1. `imageRepo.findActiveById(imageId)` で対象を取得。無ければ `NotFoundError`。
2. `sourceUrl = overrideUrl ?? existing.originalUrl`。
3. `buildLgtmVariant(sourceUrl, { excludeImageId: imageId })` を呼び新素材を生成 (Blob put まで完了)。
4. `imageRepo.updateAfterRegenerate(imageId, { originalUrl: overrideUrl ? sourceUrl : undefined, imageUrl, pHash, width, height, fileSizeBytes, isAnimated })` を実行。
5. 4 が成功したら旧 `existing.imageUrl` を `blob.del().catch(...)` (best-effort)。
6. 4 が失敗したら新 Blob を `blob.del().catch(...)` して throw。
7. `console.info('[regenerateImage] ...')` で `requesterId`, `imageId`, `oldImageUrl`, `newImageUrl`, `urlChanged` を出す (監査ログ)。

**日次アップロード数は加算しない。**

理由:
- `original_url` を「差し替えたときだけ更新」で表現するため、differ を Repository 呼び出し側で決める (Service で分岐)。
- 認可は「呼び出し側で `requireAdmin` を通した前提」を Service にドキュメント。Service が二重に is_admin を引くとテストが煩雑になる。

### 3.3 Repository 追加

```ts
// 自レコードを除外した重複検出
async listActivePHashesExcept(excludeId: string): Promise<ActivePHashEntry[]> {
  const { data, error } = await this.supabase
    .from('lgtm_images')
    .select('id, p_hash')
    .eq('status', 'active')
    .neq('id', excludeId);
  ...
}

interface UpdateAfterRegenerateInput {
  imageUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  isAnimated: boolean;
  originalUrl?: string;      // 差し替え時のみ
}

// 再生成時の更新 (id + status='active' で WHERE 縛り。updated_at は DB トリガに任せる/なければ明示)
async updateAfterRegenerate(id: string, patch: UpdateAfterRegenerateInput): Promise<LgtmImage> {
  const update: Partial<LgtmImageInsert> = {
    image_url: patch.imageUrl,
    p_hash: patch.pHash,
    width: patch.width,
    height: patch.height,
    file_size_bytes: patch.fileSizeBytes,
    is_animated: patch.isAnimated,
    updated_at: new Date().toISOString(),
  };
  if (patch.originalUrl !== undefined) update.original_url = patch.originalUrl;

  const { data, error } = await this.supabase
    .from('lgtm_images')
    .update(update)
    .eq('id', id)
    .eq('status', 'active')
    .select('*')
    .single();
  if (error) throw new DatabaseError(error.message);
  if (!data) throw new NotFoundError('画像', id);
  return toLgtmImage(data);
}
```

- `updated_at` は DB 側の `on update` トリガがある前提だが、既存 `create` で見えないため safe に明示 update。マイグレーション追加は本 PR スコープ外。

## 4. Route Handler

`app/api/images/[id]/regenerate/route.ts`:

```ts
export const maxDuration = 60;  // 合成が長い可能性があるため /api/images/route.ts と同じ

export async function POST(request, { params }) {
  const resolved = await params;
  const parsed = paramsSchema.safeParse(resolved);
  if (!parsed.success) return 400;

  const supabase = await createClient();
  try {
    const { userId } = await requireAdmin(supabase);

    const bodyRaw = await request.json().catch(() => ({}));   // 空ボディ許容
    const bodyParsed = regenerateImageRequestSchema.safeParse(bodyRaw ?? {});
    if (!bodyParsed.success) return 400;

    const service = buildImageService(supabase);
    const image = await service.regenerateImage(
      parsed.data.id,
      userId,
      bodyParsed.data.originalUrl,
    );
    revalidateTag(HOME_IMAGES_CACHE_TAG, 'max');
    return NextResponse.json({ id: image.id, imageUrl: image.imageUrl }, { status: 200 });
  } catch (err) {
    // DuplicateImageError → 409, NotFoundError → 404, BadRequestError → 400,
    // ForbiddenError → 403, UnauthorizedError → 401, AppError → 500
  }
}
```

- **empty body 許容**: `.json()` が throw する場合と `null` を返す場合の両方をカバー。
- **エラー変換順序**: 具体サブクラスを先に判定し、末尾で AppError。
- **cacheComponents**: この route は動的挙動が明白 (認証必須 + POST) なので `connection()` 不要。

## 5. Validation スキーマ

`src/lib/validation/image.ts` に追記:

```ts
export const regenerateImageRequestSchema = z.object({
  originalUrl: z
    .string()
    .max(2048)
    .url('画像 URL の形式が正しくありません')
    .startsWith('https://', 'HTTPS の URL を入力してください')
    .optional(),
});

export const regenerateImageResponseSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
});
```

- **min(1) を付けない**: 存在しない = 省略と等価にしたい。`z.string().url()` は空文字も落ちるため、`optional()` だけで十分。
- 400 のエラー本文シェイプは既存の `createImageErrorResponseSchema` 相当を再利用しない (existingImageId は返す)。

## 6. Client Component (`ImageRegenerateAction`)

- 見た目・状態機械は `ImageDetailActions` を踏襲。
- 差分:
  - トリガーは「画像を再生成」(青系)。
  - Dialog Body に `<input>` (プリフィル: 現在の originalUrl)。空文字 → body から `originalUrl` を除外して送信 (既存 URL 再利用)。
  - `POST` 成功 (200) 時: `router.refresh()` のみ (詳細ページ内で再取得すればよいので `push('/')` はしない)。
  - `data-testid` prefix は `image-regenerate-*`。
- Props: `{ imageId: string; currentOriginalUrl: string }`。

## 7. 詳細ページの変更 (`app/(site)/images/[id]/page.tsx`)

- `Promise.all` で並列取得している segment に追加変更:
  - `supabase.auth.getUser()` の結果から `user.id` を得たあと `buildUserProfileService(supabase).findById(user.id)` を呼び `isAdmin` を判定する (追加の DB call が発生するが 1 件のみ・詳細ページなので許容)。
- `DetailView` に `isAdmin` を渡し、`isAdmin ? <ImageRegenerateAction ... /> : null` を追加。
- `original_url` は `PublicLgtmImage` に含まれないため、詳細ページ内で `getImageWithOriginalUrl` に相当する取得が必要。方針:
  - **最小変更**: `image-service` に **`getImageForAdmin(id)` を追加せず**、詳細ページの Server Component 内で `imageRepo` を直接使う (は architecture 違反)。
  - 代替: `ImageService.getImageWithOriginal(id)` を追加し、内部で `findActiveById` を呼び `{ public: PublicLgtmImage, originalUrl: string }` 相当を返す。
  - **採用**: `ImageService.getImageDetail(id)` を追加し、詳細ページ用の型 `LgtmImageDetail extends PublicLgtmImage & { originalUrl: string }` を返す。**ただし `originalUrl` はサーバー側 `isAdmin` の時だけクライアントへ渡す。** 実装は「常に取得し、UI 分岐で管理者にのみ渡す」。
  - シンプル化: 既存 `getImage` の戻り値に `originalUrl` を含める *拡張は影響大*。代わりに **新規 method `getImageDetail`** を追加し、返り値は `PublicLgtmImageDetail`。

型:
```ts
// src/types/image.ts
export interface PublicLgtmImageDetail extends PublicLgtmImage {
  originalUrl: string;
}
```

`ImageService`:
```ts
async getImageDetail(id: string): Promise<PublicLgtmImageDetail | null> {
  const img = await this.imageRepo.findActiveById(id);
  return img ? { ...toPublic(img), originalUrl: img.originalUrl } : null;
}
```

- 既存の `getImage` はそのまま残す (他呼び出し元があるかは grep で確認して未使用なら削除、使用中なら残置)。**方針: 既存が page.tsx 以外から使われていないなら `getImage` を `getImageDetail` に置き換え**、page.tsx を差し替える。

## 8. Cache 無効化

- `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')` を Route Handler で呼ぶ (削除 route と同型)。
- 詳細ページ側は `router.refresh()` により RSC が再フェッチされる。
- Blob URL が変わるので CDN / ブラウザは新 URL を新規リクエストとして扱う (免除される)。

## 9. ログ

- `console.info('[POST /api/images/[id]/regenerate] regenerated', { requesterId, imageId, urlChanged, previousImageUrl, newImageUrl })`。
- 詳細な PII を含めないため `original_url` はログしない (URL 変更の有無だけ記録)。

## 10. テスト戦略

| レイヤー | ファイル | 内容 |
|---------|---------|------|
| Auth util | `tests/unit/lib/auth/require-admin.test.ts` | 未ログイン→Unauthorized / row 欠損→Forbidden / is_admin=false→Forbidden / is_admin=true→OK |
| Repository | `tests/unit/repositories/image-repository.test.ts` (追加) | `listActivePHashesExcept` が excludeId を除外する / `updateAfterRegenerate` が status='active' を条件にする |
| Service | `tests/unit/services/image-service.test.ts` (追加) | regenerateImage: 既存 URL 再利用 / URL 差し替え / 重複判定で自 ID 除外 / DailyLimit 加算されない / DB 更新失敗で新 Blob del / 旧 Blob del ベストエフォート |
| API | `tests/unit/api/images/regenerate-route.test.ts` | 400 / 401 / 403 / 404 / 409 / 200 / revalidateTag 呼び出し |
| UI | `tests/unit/api/images/regenerate-route.test.ts` に含めない | Component の render テストは Vitest では実装コスト大なので E2E に委ねる (今回は unit テスト対象外) |
| E2E | 今回は対象外 | 管理者ログインシナリオが未整備、本 Issue のスコープではない (Out of Scope) |

## 11. 影響範囲・リスク

- `getImage → getImageDetail` の置き換えは詳細ページ 1 箇所のみに閉じるので影響小。他呼び出し元があれば残置。
- `is_admin` の boot-time null 化 (schema 上 default true?) は既存 schema を参照し確定。既存 repository は `isAdmin: row.is_admin` 直接マップ済みなので追加検討不要。
- Blob 削除失敗ケースはログのみで運用に委ねる (Requirements の通り)。
