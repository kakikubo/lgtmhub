# 設計: 画像登録 API

## 全体方針

- レイヤードアーキテクチャ(Presentation/API → Service → Repository)に沿って一直線に実装する
- ビジネスルール(上限/重複/合成)は **`ImageService`** に集約し、Route Handler は HTTP 境界・認証・スキーマ検証・エラー変換のみに専念
- 画像処理 (Sharp / pHash / SVG 合成) と SSRF 安全 fetch は **`src/lib/`** 配下に純粋関数として切り出し、Service からのみ参照
- DB 書き込み (lgtm_images insert + daily_upload_counts upsert) は service 層で順序立てて呼び、insert 失敗時は **既にアップロード済みの Blob を `del()` でロールバック** する

## アーキテクチャ上の位置付け

```
Presentation (将来 components/image-register-form.tsx)
   ↓ fetch POST /api/images
API Layer (app/api/images/route.ts)
   ↓ ImageService.createImage(uploaderId, imageUrl)
Service (src/services/image-service.ts)
   ├→ DailyUploadCountRepository.getCount() / increment()
   ├→ safeFetch(imageUrl)            ← src/lib/http/safe-fetch.ts
   ├→ validateImage(buffer)          ← src/lib/image/validate-image.ts
   ├→ calculatePHash(buffer)         ← src/lib/image/calculate-phash.ts
   ├→ ImageRepository.findDuplicateByPHash(pHash)
   ├→ composeLgtmImage(buffer)       ← src/lib/image/compose-lgtm.ts
   ├→ put(path, buffer)              ← @vercel/blob
   └→ ImageRepository.create(row)
```

## DB スキーマ

### マイグレーション: `supabase/migrations/20260504000000_create_lgtm_images.sql`

- `lgtm_images` テーブル (id uuid pk, uploader_id uuid fk, original_url text, image_url text, p_hash text, width/height int, file_size_bytes bigint, mime_type text default 'image/webp', status text check in ('processing','active','deleted') default 'processing', deleted_at timestamptz null, created_at/updated_at timestamptz)
- インデックス: `(p_hash)`, `(status, created_at desc)` (一覧取得最適化を将来見込んで)
- `set_updated_at` トリガを既存関数で再利用 (function は user_profiles 用に既に存在)
- RLS:
  - SELECT: `status = 'active'` を全員許可
  - INSERT: `auth.uid() = uploader_id`
  - UPDATE: 本人 or 管理者(削除/復活操作・PRD #2/#6 で利用)
- `mime_type` は MVP 段階では `'image/webp'` 固定だが check 制約は緩めに保留 (将来の GIF 静止画化等を見込み外す)

### マイグレーション: `supabase/migrations/20260504000001_create_daily_upload_counts.sql`

- `daily_upload_counts` テーブル: `user_id uuid not null fk`, `date date not null`, `count integer not null default 0 check (count >= 0)`
- 複合 PK: `(user_id, date)`
- RLS: 自分の行のみ SELECT/INSERT/UPDATE 可能 (`auth.uid() = user_id`)
- atomic UPSERT 用の RPC は **作らない**: Postgres の `insert ... on conflict (user_id, date) do update set count = daily_upload_counts.count + 1 returning count` で十分
  - Supabase JS SDK では `.from('daily_upload_counts').upsert({...}, { onConflict: 'user_id,date', ignoreDuplicates: false }).select()` で代替し、increment 専用 RPC 関数 `increment_daily_upload_count(uid uuid, d date)` を SECURITY DEFINER で別途定義する
  - **採用**: SQL 関数 (RPC) を migration 内で定義し、Service から `supabase.rpc('increment_daily_upload_count', { p_user_id, p_date })` で呼ぶ。これで race-free な atomic increment と上限チェック後の競合を回避

### `database.types.ts` の更新方針

- 既存の手書きパターンに従い、追加テーブル 2 件 (`lgtm_images` / `daily_upload_counts`) と RPC 関数 1 件 (`increment_daily_upload_count`) の Row/Insert/Update/Functions 型を追記
- `Database['public']['Functions']` に追加する型定義は `Args` と `Returns` を明示

## レイヤー詳細

### `src/lib/http/safe-fetch.ts`

```ts
export interface SafeFetchOptions {
  maxBytes: number;             // 既定 10MB
  timeoutMs: number;            // 既定 8s
  allowedContentTypes: string[]; // image/jpeg|png|gif
}

export async function safeFetch(rawUrl: string, opts: SafeFetchOptions): Promise<{
  buffer: Buffer;
  contentType: string;
}>;
```

- `new URL()` で parse、`protocol === 'https:'` のみ許可
- DNS 解決後の IP がプライベートレンジ/loopback/link-local なら `BadRequestError`
- `fetch(url, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })`
- レスポンスを `body.getReader()` で逐次読み出し、累積バイト数が `maxBytes` を超えたら abort
- `Content-Type` ヘッダが `allowedContentTypes` に含まれない場合は `BadRequestError`

### `src/lib/image/validate-image.ts`

- Sharp の `metadata()` でフォーマットを再確認 (Content-Type 偽装対策)
- `format ∈ {jpeg, png, gif}` 以外なら `BadRequestError`
- アニメーション GIF は `pages > 1` で検出して reject (PRD は静止画のみ)

### `src/lib/image/calculate-phash.ts`

```ts
export function hammingDistance(a: string, b: string): number;
export async function calculatePHash(buffer: Buffer): Promise<string>;
export const DUPLICATE_THRESHOLD = 10;
export function isDuplicate(a: string, b: string): boolean;
```

- 32x32 grayscale → mean を計算 → `>= mean ? '1' : '0'` で 1024 ビット文字列
- ハミング距離は文字単位差分の数

### `src/lib/image/compose-lgtm.ts`

- 入力: `Buffer`、出力: `Promise<{ buffer: Buffer; width: number; height: number; byteLength: number }>`
- 機能設計書のサンプルロジックを踏襲、`MAX_OUTPUT_WIDTH = 1200`
- SVG オーバーレイを Buffer 化して `composite([{ input, blend: 'over' }])`
- `webp({ quality: 85 }).toBuffer()` で出力

### `src/lib/validation/image.ts`

```ts
import { z } from 'zod';

export const createImageRequestSchema = z.object({
  imageUrl: z.string().min(1).max(2048).url().refine((u) => u.startsWith('https://')),
});

export type CreateImageRequest = z.infer<typeof createImageRequestSchema>;
```

### `src/repositories/image-repository.ts`

```ts
class ImageRepository {
  async create(row: NewLgtmImage): Promise<LgtmImage>;        // status='active' 直接作成
  async findActiveByPHashes(pHashes: string[]): Promise<{ id: string; pHash: string }[]>;
  // pHash 全件比較は service 側でハミング距離計算するため、まずは全件取得 (status='active' のみ)
  async listActivePHashes(): Promise<{ id: string; pHash: string }[]>;
}
```

- `Database` 型でジェネリクス指定、結果を camelCase に変換 (既存 user-profile-repository に倣う)
- 一覧の pHash 取得は MVP では全件 SELECT(機能設計書 "10万件超で pgvector 移行" のため許容)

### `src/repositories/daily-upload-count-repository.ts`

```ts
class DailyUploadCountRepository {
  async getCount(userId: string, date: string): Promise<number>;
  async increment(userId: string, date: string): Promise<number>; // RPC 経由・新カウントを返す
}
```

### `src/services/image-service.ts`

```ts
class ImageService {
  constructor(
    private readonly imageRepo: ImageRepository,
    private readonly countRepo: DailyUploadCountRepository,
    private readonly blob: BlobClient,           // put / del を持つ薄いラッパ (DI 用)
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async createImage(uploaderId: string, imageUrl: string): Promise<LgtmImage> {
    const today = formatDate(this.clock());                  // YYYY-MM-DD (UTC)
    const count = await this.countRepo.getCount(uploaderId, today);
    if (count >= MAX_DAILY_UPLOADS) throw new DailyLimitExceededError();

    const { buffer } = await safeFetch(imageUrl, { ... });
    await validateImage(buffer);

    const pHash = await calculatePHash(buffer);
    const existing = await this.imageRepo.listActivePHashes();
    const dup = existing.find((e) => isDuplicate(e.pHash, pHash));
    if (dup) throw new DuplicateImageError(dup.id);

    const composed = await composeLgtmImage(buffer);

    const blobKey = `lgtm/${randomUUID()}.webp`;
    const { url } = await this.blob.put(blobKey, composed.buffer);

    try {
      const created = await this.imageRepo.create({
        uploaderId,
        originalUrl: imageUrl,
        imageUrl: url,
        pHash,
        width: composed.width,
        height: composed.height,
        fileSizeBytes: composed.byteLength,
        mimeType: 'image/webp',
        status: 'active',
      });
      await this.countRepo.increment(uploaderId, today);
      return created;
    } catch (err) {
      await this.blob.del(url).catch(() => undefined);   // ロールバック
      throw err;
    }
  }
}
```

- **時刻**: テストで時刻を固定できるよう `clock` を DI
- **Blob ラッパ**: `put` / `del` だけを公開する `BlobClient` インターフェースを定義し、本番実装は `@vercel/blob` の `put` / `del` をそのまま委譲、テストでは fake を注入
- **upload count の order**: 上限チェック後にも別ユーザーが先に 10 枚目を入れる競合があり得るため、`increment` 時に RPC 内で `count >= 10` を再チェックして超過なら例外を発生させる選択肢もあるが、MVP では「先勝ちで 10 件目はギリで通す/超過時の二重通知は許容」とする(機能設計書のレベル感に合わせる)。再チェックは PRD KPI 拡張時の TODO

### `app/api/images/route.ts`

```ts
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = createImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '入力値が不正です' }, { status: 400 });
  }

  try {
    const service = buildImageService(supabase);  // DI ファクトリ
    const image = await service.createImage(user.id, parsed.data.imageUrl);
    return NextResponse.json({ id: image.id, imageUrl: image.imageUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof DailyLimitExceededError) return NextResponse.json({ error: err.message }, { status: 429 });
    if (err instanceof DuplicateImageError) return NextResponse.json({ error: err.message, existingImageId: err.existingImageId }, { status: 409 });
    if (err instanceof BadRequestError) return NextResponse.json({ error: err.message }, { status: 400 });
    if (err instanceof UnauthorizedError) return NextResponse.json({ error: err.message }, { status: 401 });
    console.error('[POST /api/images]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
```

- DI ファクトリ `buildImageService(supabase)` は `src/services/image-service.ts` 内に同梱(別ファイルにせず最小化)

## エラー設計

| 例外 | HTTP | 備考 |
|------|------|------|
| (未ログイン) | 401 | route.ts で先行チェック |
| `BadRequestError` | 400 | URL 形式 / SSRF / フォーマット / サイズ |
| `DailyLimitExceededError` | 429 | service 上限チェック |
| `DuplicateImageError` | 409 | `existingImageId` を含めて返す |
| `DatabaseError` / その他 | 500 | スタックを露出しない |

## テスト方針

| 対象 | テスト形式 | 主なケース |
|------|---------|----------|
| `src/lib/image/calculate-phash.ts` | Vitest unit | 同一画像の同一性 / 異なる画像の差分 / hamming distance / threshold |
| `src/lib/image/compose-lgtm.ts` | Vitest unit (Sharp 実行) | 出力が WebP / 幅 1200px 以内 / "LGTM" 文字色 (ピクセル抽出は過剰なのでメタデータ検証まで) |
| `src/lib/image/validate-image.ts` | Vitest unit | JPEG/PNG/GIF OK、SVG / TIFF reject、アニメ GIF reject |
| `src/lib/http/safe-fetch.ts` | Vitest unit | プライベート IP reject / HTTPS 限定 / Content-Type 制限 / サイズ超過 reject |
| `src/lib/validation/image.ts` | Vitest unit | URL 検証(http reject / 長すぎる reject) |
| `src/repositories/image-repository.ts` | Vitest unit | Supabase スタブで CRUD |
| `src/repositories/daily-upload-count-repository.ts` | Vitest unit | スタブで getCount / increment |
| `src/services/image-service.ts` | Vitest unit | 上限超過 / 重複検出 / 正常系 / Blob ロールバック |

統合テスト・E2E は本フェーズではスコープ外。

## 観点別ガード

- **SSRF**: `safeFetch` でプライベート IP を弾く・redirect 禁止・HTTPS 限定
- **重複防止**: pHash 全件比較 + 閾値判定。N が大きくなれば pgvector 化
- **競合**: increment は RPC で atomic、ただし上限超過は機能設計書のレベル感で許容
- **Blob リーク**: DB insert 失敗時に `blob.del()` でロールバック
- **メモリ**: 10MB 上限を `safeFetch` で強制し、Sharp に渡す前に確定させる
- **タイムアウト**: `safeFetch` を 8 秒に絞り、合成・Blob 書き込み込みで 10 秒以内
