import { randomUUID } from 'node:crypto';
import { del, put } from '@vercel/blob';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DailyLimitExceededError, DuplicateImageError } from '@/src/lib/errors';
import { safeFetch } from '@/src/lib/http/safe-fetch';
import { calculatePHash, isDuplicate } from '@/src/lib/image/calculate-phash';
import { composeLgtmImage } from '@/src/lib/image/compose-lgtm';
import { validateImage } from '@/src/lib/image/validate-image';
import { DailyUploadCountRepository } from '@/src/repositories/daily-upload-count-repository';
import { ImageRepository } from '@/src/repositories/image-repository';
import type { Database } from '@/src/types/database.types';
import type { LgtmImage } from '@/src/types/image';

export const MAX_DAILY_UPLOADS = 10;

export interface BlobClient {
  put(pathname: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  del(url: string): Promise<void>;
}

const defaultBlobClient: BlobClient = {
  async put(pathname, body, contentType) {
    const result = await put(pathname, body, { access: 'public', contentType });
    return { url: result.url };
  },
  async del(url) {
    await del(url);
  },
};

function formatUtcDate(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export interface ImageServiceDeps {
  imageRepo: ImageRepository;
  countRepo: DailyUploadCountRepository;
  blob?: BlobClient;
  clock?: () => Date;
}

export class ImageService {
  private readonly imageRepo: ImageRepository;
  private readonly countRepo: DailyUploadCountRepository;
  private readonly blob: BlobClient;
  private readonly clock: () => Date;

  constructor(deps: ImageServiceDeps) {
    this.imageRepo = deps.imageRepo;
    this.countRepo = deps.countRepo;
    this.blob = deps.blob ?? defaultBlobClient;
    this.clock = deps.clock ?? (() => new Date());
  }

  /**
   * 画像登録のオーケストレーション。
   *
   * 順序の意図:
   *   1. preflight `getCount` で「明らかに上限超え」を早期に弾く (UX のため)
   *   2. 取得 → 検証 → pHash → 重複判定 → 合成 を行う
   *   3. atomic な `increment` で「上限内なら +1」をレース無く確定する。
   *      ここで失敗 (DailyLimitExceededError) しても Blob はまだアップロードしていないので
   *      ロールバックは不要。
   *   4. Blob 保存 → DB 登録の順で実行する。DB 登録が最後なので、DB に
   *      "Blob 不在の active 行" が残るケースが構造的に存在しない。
   *   5. DB 登録が失敗した場合のみ Blob を `del()` でロールバックする。
   *      この場合、当日の枠は 1 つ消費済みのままだが、レアな異常系のため許容する。
   */
  async createImage(uploaderId: string, imageUrl: string): Promise<LgtmImage> {
    const today = formatUtcDate(this.clock());

    const currentCount = await this.countRepo.getCount(uploaderId, today);
    if (currentCount >= MAX_DAILY_UPLOADS) {
      throw new DailyLimitExceededError();
    }

    const { buffer } = await safeFetch(imageUrl);
    await validateImage(buffer);

    const pHash = await calculatePHash(buffer);
    // pHash 比較は「閲覧可能な画像」のみを対象とする (status='active')。
    // 論理削除済み画像は導線上参照できないため、再登録できる方が UX として自然。
    // 全件突き合わせは 10 万件超で pgvector 移行を検討する (architecture.md 参照)。
    const existing = await this.imageRepo.listActivePHashes();
    const duplicate = existing.find((entry) => isDuplicate(entry.pHash, pHash));
    if (duplicate) {
      throw new DuplicateImageError(duplicate.id);
    }

    const composed = await composeLgtmImage(buffer);

    // 上限チェック + atomic increment は RPC 内で完結する (TOCTOU レース対策)
    await this.countRepo.increment(uploaderId, today);

    const blobKey = `lgtm/${randomUUID()}.webp`;
    const { url } = await this.blob.put(blobKey, composed.buffer, 'image/webp');

    try {
      return await this.imageRepo.create({
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
    } catch (err) {
      // DB 登録失敗時は Blob をロールバックして孤児ファイルを残さない
      await this.blob.del(url).catch(() => undefined);
      throw err;
    }
  }
}

export function buildImageService(supabase: SupabaseClient<Database>): ImageService {
  return new ImageService({
    imageRepo: new ImageRepository(supabase),
    countRepo: new DailyUploadCountRepository(supabase),
  });
}
