# 設計: 画像一覧画面

## 全体方針

- レイヤードアーキテクチャ (Presentation → API/Service → Repository) を踏襲する
- 初期描画は **Server Component** で `ImageService.listImages()` を直接呼び、SSR 配信で LCP を確保する
- 「もっと読み込む」だけ **Client Component** にし、`fetch('/api/images?cursor=...')` で追加ページを取得する
- マークダウンコピーは Client Component で `navigator.clipboard.writeText()`、2 秒後に元に戻す state を保持
- カーソル方式は「`createdAt` の ISO 文字列」で表現する。`(createdAt < cursor)` で次ページ取得

## アーキテクチャ上の位置付け

```
Presentation
  ├─ app/(site)/page.tsx               (Server Component)
  │    └─ ImageService.listImages({ limit: 20 })
  ├─ components/image-grid.tsx         (Server Component)
  ├─ components/image-card.tsx         (Server Component)
  ├─ components/copy-markdown-button.tsx (Client Component)
  └─ components/load-more-button.tsx     (Client Component, fetch /api/images)

API Layer
  └─ app/api/images/route.ts (既存 POST に加えて GET を追加)
        └─ ImageService.listImages({ cursor?, limit? })

Service
  └─ src/services/image-service.ts
        └─ ImageRepository.list({ cursor?, limit? })

Data
  └─ src/repositories/image-repository.ts
        └─ supabase.from('lgtm_images').select(...).eq('status','active').order('created_at', desc).limit(N).lt('created_at', cursor?)
```

## レイヤー詳細

### `src/lib/validation/image.ts` (拡張)

既存 `createImageRequestSchema` に加えて、画像一覧 API のクエリスキーマを追加する。

```ts
export const LIST_IMAGES_DEFAULT_LIMIT = 20;
export const LIST_IMAGES_MAX_LIMIT = 50;

export const listImagesQuerySchema = z.object({
  cursor: z
    .string()
    .datetime({ message: 'cursor は ISO 8601 形式で指定してください' })
    .optional(),
  limit: z.coerce
    .number()
    .int('limit は整数で指定してください')
    .min(1, 'limit は 1 以上で指定してください')
    .max(LIST_IMAGES_MAX_LIMIT, `limit は ${LIST_IMAGES_MAX_LIMIT} 以下で指定してください`)
    .optional(),
});

export type ListImagesQuery = z.infer<typeof listImagesQuerySchema>;
```

- `z.coerce.number()` で `URLSearchParams.get('limit')` が string でも数値変換できる
- `cursor` は ISO 8601 (`2026-05-04T12:00:00.000Z`) のみ受理
- `LIST_IMAGES_MAX_LIMIT` (50) はサービス層 / コンポーネント側でも参照する

### `src/repositories/image-repository.ts` (拡張)

`list` メソッドを追加。既存の `create` / `listActivePHashes` には触らない。

```ts
export interface ListImagesOptions {
  cursor?: string;          // ISO 8601 文字列
  limit: number;            // 既に正規化済み
}

class ImageRepository {
  async list(options: ListImagesOptions): Promise<LgtmImage[]> {
    let query = this.supabase
      .from('lgtm_images')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(options.limit);

    if (options.cursor) {
      query = query.lt('created_at', options.cursor);
    }

    const { data, error } = await query;
    if (error) throw new DatabaseError(error.message);
    return (data ?? []).map(toLgtmImage);
  }
}
```

- 既存 `toLgtmImage` を再利用 (現在は `create` 内で private にしているので、`list` から呼ぶためモジュールスコープへ昇格する。既存の挙動は変えない)
- `eq('status', 'active')` は RLS でも担保されているが、型安全性 (status 文字列) と将来 service_role 利用時のために repository 側でも明示する

### `src/types/image.ts` (拡張)

公開用の薄い型を追加 (API 一覧レスポンスでフィールド絞り込みするため)。

```ts
export interface PublicLgtmImage {
  id: string;
  imageUrl: string;
  uploaderId: string;
  createdAt: Date;
}
```

`LgtmImage` から `PublicLgtmImage` を作るマッピングは Service 層で行う。

### `src/services/image-service.ts` (拡張)

`listImages` メソッドと、その戻り値型を追加。

```ts
export interface ListImagesParams {
  cursor?: string;
  limit?: number;
}

export interface ListImagesResult {
  images: PublicLgtmImage[];
  nextCursor: string | null;
}

class ImageService {
  async listImages(params: ListImagesParams = {}): Promise<ListImagesResult> {
    const limit = params.limit ?? LIST_IMAGES_DEFAULT_LIMIT;
    const records = await this.imageRepo.list({ cursor: params.cursor, limit });
    const images = records.map(toPublic);
    const nextCursor =
      records.length === limit
        ? records[records.length - 1]!.createdAt.toISOString()
        : null;
    return { images, nextCursor };
  }
}
```

- `nextCursor` は「`limit` ちょうどで返ってきたとき」の最終要素の `createdAt`
- 1 件未満や最終ページでは `null`
- `LIST_IMAGES_DEFAULT_LIMIT` は validation から再エクスポート (定数の二重定義を避ける)

### `app/api/images/route.ts` (拡張)

既存ファイルに `GET` を追加する。同ファイル内に置き、import 重複を避ける。

```ts
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = listImagesQuerySchema.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const service = buildImageService(supabase);
    const result = await service.listImages(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error('[GET /api/images]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
```

- `URLSearchParams.get('cursor')` が空文字を返すケースに備え、`Object.fromEntries` で undefined 化されない場合は zod の `.optional()` だけでは弾けないので、空文字は事前に削除する。実装では undefined 化を行う:
  ```ts
  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const params = {
    cursor: raw.cursor && raw.cursor.length > 0 ? raw.cursor : undefined,
    limit: raw.limit && raw.limit.length > 0 ? raw.limit : undefined,
  };
  ```

### Presentation Layer

#### `app/(site)/page.tsx`

既存実装 (ようこそ + ログインボタン) を画像一覧画面に置き換える。

```tsx
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';
import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { signInWithGithub } from '@/src/lib/auth/actions';

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { images, nextCursor } = await buildImageService(supabase).listImages();

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">LGTM 画像一覧</h1>
        {!user && (
          <p className="text-sm text-gray-600">
            画像の閲覧とマークダウンのコピーはログイン不要です。
            画像を登録するには GitHub でログインしてください。
          </p>
        )}
      </header>

      {images.length === 0 ? (
        <EmptyState isLoggedIn={!!user} />
      ) : (
        <>
          <ImageGrid images={images} />
          {nextCursor && <LoadMoreButton initialCursor={nextCursor} />}
        </>
      )}

      {!user && (
        <form action={signInWithGithub}>
          <button className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700">
            ログインして登録
          </button>
        </form>
      )}
    </section>
  );
}
```

`EmptyState` は同ファイル内の小コンポーネント (Server Component) として定義。

#### `components/image-grid.tsx` (Server Component)

```tsx
import { ImageCard } from '@/components/image-card';
import type { PublicLgtmImage } from '@/src/types/image';

export function ImageGrid({ images }: { images: PublicLgtmImage[] }) {
  return (
    <ul
      data-testid="image-grid"
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      {images.map((image) => (
        <li key={image.id}>
          <ImageCard image={image} />
        </li>
      ))}
    </ul>
  );
}
```

- レスポンシブクラス: `grid-cols-2` (mobile) / `md:grid-cols-3` (≥768px) / `xl:grid-cols-4` (≥1280px)

#### `components/image-card.tsx` (Server Component)

```tsx
import Image from 'next/image';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import type { PublicLgtmImage } from '@/src/types/image';

export function ImageCard({ image }: { image: PublicLgtmImage }) {
  return (
    <article className="space-y-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-50">
        <Image
          src={image.imageUrl}
          alt="LGTM"
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="object-cover"
        />
      </div>
      <CopyMarkdownButton imageUrl={image.imageUrl} />
    </article>
  );
}
```

- `aspect-[4/3]` でカード高さを揃える (画像ごとの比率はトリミングで吸収)

#### `components/copy-markdown-button.tsx` (Client Component)

```tsx
'use client';

import { useState } from 'react';

const FEEDBACK_DURATION_MS = 2000;

export function CopyMarkdownButton({ imageUrl }: { imageUrl: string }) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    const markdown = `![LGTM](${imageUrl})`;
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), FEEDBACK_DURATION_MS);
    } catch {
      // 失敗しても致命ではない: ユーザーがリトライできるよう状態を戻す
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      data-testid="copy-markdown-button"
      className="w-full text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
    >
      {copied ? 'コピーしました ✓' : 'マークダウンをコピー'}
    </button>
  );
}
```

#### `components/load-more-button.tsx` (Client Component)

```tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { PublicLgtmImage } from '@/src/types/image';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';

interface ListResponse {
  images: PublicLgtmImage[];
  nextCursor: string | null;
}

export function LoadMoreButton({ initialCursor }: { initialCursor: string }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [extra, setExtra] = useState<PublicLgtmImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/images?cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as ListResponse;
      // 次に届いた image は createdAt の Date 復元が必要
      const restored = json.images.map((img) => ({
        ...img,
        createdAt: new Date(img.createdAt as unknown as string),
      }));
      setExtra((prev) => [...prev, ...restored]);
      setCursor(json.nextCursor);
    } catch (e) {
      setError('読み込みに失敗しました。時間をおいて再度お試しください');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {extra.length > 0 && (
        <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {extra.map((image) => (
            <li key={image.id}>
              <article className="space-y-2">
                <div className="relative aspect-[4/3] overflow-hidden rounded border bg-gray-50">
                  <Image
                    src={image.imageUrl}
                    alt="LGTM"
                    fill
                    sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <CopyMarkdownButton imageUrl={image.imageUrl} />
              </article>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className="text-sm border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '読み込み中…' : 'もっと読み込む'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- `cache: 'no-store'` で常に最新を取得 (CDN キャッシュを無視)
- API レスポンスの `createdAt` は JSON 上は string になるため Date に戻す
- 次の `nextCursor` が `null` ならボタンを消す
- エラー時はメッセージを出してリトライ可能にする

#### `data-testid` の用途

- `image-grid`: 一覧グリッド存在の有無を E2E から確認する
- `copy-markdown-button`: コピー導線の存在確認

### `next.config.ts` (変更不要)

Vercel Blob remote pattern (`*.public.blob.vercel-storage.com`) は既に許可済み。

## エラー設計

| 場面 | 例外 / 状態 | レスポンス / UI |
|------|------------|----------------|
| `cursor` が ISO 8601 でない | zod 失敗 | 400 + `{ error: 'cursor は ISO 8601 形式で指定してください' }` |
| `limit` が範囲外 | zod 失敗 | 400 + 該当メッセージ |
| Repository / Service 内部例外 | DatabaseError 等 | 500 + `{ error: 'サーバーエラーが発生しました' }` (内部詳細は隠蔽し `console.error` でログ) |
| Client `LoadMoreButton` の fetch 失敗 | network / non-2xx | UI に「読み込みに失敗しました」メッセージ、ボタンは再度有効化 |

## テスト方針

| 対象 | テスト形式 | 主なケース |
|------|---------|----------|
| `src/lib/validation/image.ts` (`listImagesQuerySchema`) | Vitest unit | cursor 未指定 / 不正な ISO / limit 文字列 → 数値 / 0 や 51 でエラー / 1 と 50 で成功 |
| `src/repositories/image-repository.ts` (`list`) | Vitest unit | cursor 無し / cursor 有り (`lt('created_at', ...)` が呼ばれる) / 空配列 / DB エラー → DatabaseError |
| `src/services/image-service.ts` (`listImages`) | Vitest unit | デフォルト limit (20) / `limit ちょうど` で nextCursor 計算 / `limit 未満` で `nextCursor=null` / cursor 渡し |
| `app/api/images/route.ts` (`GET`) | (本タスクでは route 単体テストは追加しない。既存 POST にもユニットテストはなく、統合テスト基盤整備で扱う) | — |
| `tests/e2e/image-list.test.ts` | Playwright | 未ログインで `/` を開いて `data-testid="image-grid"` または empty state が表示されること、コピーボタンが画面上に存在するときはクリックでクリップボードにアクセスを試みる挙動になること (DB 状態に依存しない範囲) |

E2E は Supabase Local が無くても動くよう、empty state の検証パスを優先する (smoke レベル)。

## 観点別ガード

- **匿名アクセス**: RLS `anyone can view active images` が SELECT を許可しており、`createClient()` (anon key) でアクセスする設計
- **論理削除**: repository / RLS の二重で `status='active'` を強制し、削除済みを返さない
- **フィールド漏れ**: API は `PublicLgtmImage` の 4 フィールドのみ公開
- **SSRF / 外部リソース**: 一覧 API は外部 fetch を行わない
- **キャッシュ**: 今回 `Cache-Control` 付与は見送り。次タスクで Vercel Edge キャッシュ設計を行う
- **N+1**: 1 クエリで `limit` 件取得のみ。お気に入りの JOIN は今回スコープ外
- **paging**: `(createdAt < cursor)` strict less-than でカーソル末尾の重複を防ぐ。同一 `createdAt` の重複懸念は MVP では受容
