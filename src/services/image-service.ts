import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { del, put } from '@vercel/blob';
import {
  DailyLimitExceededError,
  DuplicateImageError,
  ForbiddenError,
  NotFoundError,
} from '@/src/lib/errors';
import { safeFetch } from '@/src/lib/http/safe-fetch';
import { calculatePHash, isDuplicate } from '@/src/lib/image/calculate-phash';
import { composeLgtmImage } from '@/src/lib/image/compose-lgtm';
import { validateImage } from '@/src/lib/image/validate-image';
import { LIST_IMAGES_DEFAULT_LIMIT } from '@/src/lib/validation/image';
import { DailyUploadCountRepository } from '@/src/repositories/daily-upload-count-repository';
import { ImageRepository } from '@/src/repositories/image-repository';
import type { Database } from '@/src/types/database.types';
import type { LgtmImage, PublicLgtmImage, PublicLgtmImageDetail } from '@/src/types/image';

export const MAX_DAILY_UPLOADS = 10;

// Blob 上の LGTM 画像は UUID 単位で immutable (上書き発生しない) のため、
// ブラウザ・CDN キャッシュを 1 年保持して Repeat View の LCP を最小化する。
// docs/architecture.md「キャッシュ戦略」と整合。
export const BLOB_CACHE_CONTROL_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export interface ListImagesParams {
  cursor?: string;
  limit?: number;
}

export interface ListImagesResult {
  images: PublicLgtmImage[];
  nextCursor: string | null;
}

// ランダム表示は 16 枚で完結し「もっと読み込む」を持たないため、
// nextCursor を構造的に持たせない (型レベルでページネーション不可を表現)。
export interface RandomImagesResult {
  images: PublicLgtmImage[];
}

/**
 * Fisher-Yates シャッフル (非破壊)。表示の多様化が目的なので
 * 暗号強度は不要で `Math.random` で十分。
 */
function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // tuple 代入の推論が各要素を `T | undefined` に広げるための narrowing。
    // 同一配列内 (i, j は有効インデックス) のスワップなので実行時の型は保証済み。
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

function toPublic(image: LgtmImage): PublicLgtmImage {
  return {
    id: image.id,
    imageUrl: image.imageUrl,
    uploaderId: image.uploaderId,
    width: image.width,
    height: image.height,
    isAnimated: image.isAnimated,
    createdAt: image.createdAt,
  };
}

function toPublicDetail(image: LgtmImage): PublicLgtmImageDetail {
  return { ...toPublic(image), originalUrl: image.originalUrl };
}

/**
 * `createImage` と `regenerateImage` で共通する
 * 「URL 取得 → 検証 → pHash → 重複判定 → LGTM 合成 → Blob put」を切り出した helper。
 *
 * 副作用:
 *   - blob.put が成功して返す (呼び出し元は失敗時に blob.del でロールバック可能)
 *
 * 副作用でないもの (呼び出し元の責務):
 *   - DailyLimit の消費
 *   - DB への Insert / Update
 *
 * `excludeImageId` を渡すと重複判定から自レコードを除外する (再生成時に同一 URL 再取得しても
 * 自己衝突しないようにするため)。
 */
async function buildLgtmVariant(
  imageRepo: ImageRepository,
  blob: BlobClient,
  sourceUrl: string,
  excludeImageId: string | undefined,
): Promise<{
  blobUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  isAnimated: boolean;
}> {
  const { buffer } = await safeFetch(sourceUrl);
  await validateImage(buffer);

  const pHash = await calculatePHash(buffer);
  const existing = excludeImageId
    ? await imageRepo.listActivePHashesExcept(excludeImageId)
    : await imageRepo.listActivePHashes();
  const duplicate = existing.find((entry) => isDuplicate(entry.pHash, pHash));
  if (duplicate) {
    throw new DuplicateImageError(duplicate.id);
  }

  const composed = await composeLgtmImage(buffer);

  const blobKey = `lgtm/${randomUUID()}.webp`;
  const { url } = await blob.put(blobKey, composed.buffer, 'image/webp');

  return {
    blobUrl: url,
    pHash,
    width: composed.width,
    height: composed.height,
    fileSizeBytes: composed.byteLength,
    isAnimated: composed.isAnimated,
  };
}

export interface BlobClient {
  put(pathname: string, body: Buffer, contentType: string): Promise<{ url: string }>;
  del(url: string): Promise<void>;
}

const defaultBlobClient: BlobClient = {
  async put(pathname, body, contentType) {
    const result = await put(pathname, body, {
      access: 'public',
      contentType,
      cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE_SECONDS,
    });
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

    // 取得 → 検証 → pHash → 重複判定 → 合成 → Blob put をまとめて実行する。
    // 重複判定は「閲覧可能な画像」のみを対象とする (status='active')。
    // 論理削除済み画像は導線上参照できないため、再登録できる方が UX として自然。
    // 全件突き合わせは 10 万件超で pgvector 移行を検討する (architecture.md 参照)。
    const variant = await buildLgtmVariant(this.imageRepo, this.blob, imageUrl, undefined);

    // 上限チェック + atomic increment は RPC 内で完結する (TOCTOU レース対策)。
    // Blob put の後に呼ぶことで「DB commit 直前」まで消費を遅延させ、pHash / 合成失敗時に
    // 枠を無駄に消費しないようにする。ここで失敗したら新 Blob をロールバックする。
    try {
      await this.countRepo.increment(uploaderId, today);
    } catch (err) {
      await this.blob.del(variant.blobUrl).catch(() => undefined);
      throw err;
    }

    try {
      return await this.imageRepo.create({
        uploaderId,
        originalUrl: imageUrl,
        imageUrl: variant.blobUrl,
        pHash: variant.pHash,
        width: variant.width,
        height: variant.height,
        fileSizeBytes: variant.fileSizeBytes,
        mimeType: 'image/webp',
        // アニメーション WebP / 静止 WebP の判定は compose 結果に従う (Issue #201)
        isAnimated: variant.isAnimated,
        status: 'active',
      });
    } catch (err) {
      // DB 登録失敗時は Blob をロールバックして孤児ファイルを残さない
      await this.blob.del(variant.blobUrl).catch(() => undefined);
      throw err;
    }
  }

  /**
   * 管理者による LGTM 画像の再生成 (Issue #195)。
   *
   * `createImage` と異なり:
   *   - 認可は呼び出し元 (Route Handler の `requireAdmin`) で通過済みが前提。
   *   - 日次アップロード数はカウントしない (既存の作り直し扱い)。
   *   - 重複判定は自レコードを除外する (自己衝突回避)。
   *   - 新 Blob キーで put し、DB を更新後に旧 Blob を best-effort で削除する
   *     (immutable Blob 設計を維持し、CDN/ブラウザ 1 年キャッシュ問題を回避)。
   *
   * 順序の意図:
   *   1. `findActiveById` で対象存在確認 (無ければ NotFound)。
   *   2. `buildLgtmVariant` で取得 → 検証 → 重複判定 → 合成 → 新 Blob put。
   *      この段階で失敗しても既存 Blob / 行には触れていないので「無傷でエラー」を満たす。
   *   3. `updateAfterRegenerate` で DB を更新。失敗したら新 Blob を best-effort del。
   *   4. DB 更新が成功したら旧 Blob を best-effort del。失敗しても孤児 Blob をログに残し
   *      日次クリーンアップに委ねる (2 フェーズコミットしない)。
   *
   * 監査ログはこの Service では出さず、Route Handler 層で `console.info` する
   * (誰が実行したかは Handler が `requireAdmin` から知っているため)。
   *
   * @throws NotFoundError - 対象画像が存在しない / 論理削除済み
   * @throws DuplicateImageError - 差し替え先が他の active 画像と実質同一
   * @throws BadRequestError - safeFetch / validateImage の失敗
   */
  async regenerateImage(
    imageId: string,
    overrideOriginalUrl: string | undefined,
  ): Promise<{ image: LgtmImage; previousImageUrl: string; urlChanged: boolean }> {
    const existing = await this.imageRepo.findActiveById(imageId);
    if (!existing) {
      throw new NotFoundError('画像', imageId);
    }

    const sourceUrl = overrideOriginalUrl ?? existing.originalUrl;
    const urlChanged =
      overrideOriginalUrl !== undefined && overrideOriginalUrl !== existing.originalUrl;

    const variant = await buildLgtmVariant(this.imageRepo, this.blob, sourceUrl, imageId);

    let updated: LgtmImage;
    try {
      updated = await this.imageRepo.updateAfterRegenerate(imageId, {
        imageUrl: variant.blobUrl,
        pHash: variant.pHash,
        width: variant.width,
        height: variant.height,
        fileSizeBytes: variant.fileSizeBytes,
        isAnimated: variant.isAnimated,
        // 差し替えたときだけ更新。undefined なら Repository が据え置きにする
        originalUrl: overrideOriginalUrl !== undefined ? sourceUrl : undefined,
      });
    } catch (err) {
      // DB 更新失敗時は新 Blob をロールバック。旧 Blob / 行はそのまま。
      await this.blob.del(variant.blobUrl).catch(() => undefined);
      throw err;
    }

    // DB 更新成功後の旧 Blob 削除は best-effort。失敗しても DB 上は新 URL を指しているため
    // 表示上の問題は無く、孤児 Blob は日次クリーンアップで回収する想定。
    await this.blob.del(existing.imageUrl).catch((err: unknown) => {
      console.warn('[regenerateImage] failed to delete previous blob', {
        imageId,
        previousImageUrl: existing.imageUrl,
        error: err,
      });
    });

    return { image: updated, previousImageUrl: existing.imageUrl, urlChanged };
  }

  /**
   * 画像を論理削除する (PRD P0 #2)。
   *
   * 順序の意図:
   *   1. findActiveById で先に 404 と 403 を判別する (UI に正確なエラー理由を返すため)
   *   2. softDelete は WHERE で本人 + active を強制 (RLS + アプリ層の多層防御)
   *   3. 1 と 2 の間に他者 (将来の管理者削除など) が削除した場合 (TOCTOU) は
   *      softDelete の更新行数が 0 になり、NotFoundError に倒す
   *
   * Vercel Blob からの物理削除は呼ばない (PRD 機能 8 の日次クリーンアップで処理)。
   * 管理者による任意ユーザーの画像削除 (PRD 機能 6 / P1) はこの Service では扱わず、
   * 別 PR で is_admin 判定と Blob 即時削除のロジックを追加する想定。
   *
   * @throws NotFoundError - 画像が存在しない / 既に削除済み
   * @throws ForbiddenError - uploader_id が requesterId と異なる
   */
  async deleteImage(id: string, requesterId: string): Promise<void> {
    const image = await this.imageRepo.findActiveById(id);
    if (!image) {
      throw new NotFoundError('画像', id);
    }
    if (image.uploaderId !== requesterId) {
      throw new ForbiddenError();
    }

    const updated = await this.imageRepo.softDelete(id, requesterId);
    if (updated === 0) {
      throw new NotFoundError('画像', id);
    }
  }

  /**
   * 画像詳細表示用に閲覧可能 (status='active') な 1 件を取得する。
   * 見つからない (= 不正な ID / 論理削除済み / 存在しない) ときは `null`。
   * 404 への変換は呼び出し元 (Server Component) の `notFound()` で行う。
   *
   * `PublicLgtmImage` に加え `originalUrl` を含む詳細用の型を返す。
   * `originalUrl` は管理者のみ (再生成 UI のプリフィル) が使う情報のため、
   * 呼び出し側で is_admin による受け渡し制御を行う。
   */
  async getImageDetail(id: string): Promise<PublicLgtmImageDetail | null> {
    const image = await this.imageRepo.findActiveById(id);
    return image ? toPublicDetail(image) : null;
  }

  /**
   * 画像一覧をカーソルページネーションで取得する。
   *
   * - `limit` ちょうどで返ってきた場合のみ `nextCursor` を返す
   *   (= 次ページが存在する可能性がある)。最終ページでは `null`。
   * - `nextCursor` は前ページ末尾の `createdAt.toISOString()`。次のリクエストで
   *   `?cursor=<nextCursor>` を渡すと、Repository が `lt('created_at', cursor)` で次ページを取得する。
   */
  async listImages(params: ListImagesParams = {}): Promise<ListImagesResult> {
    const limit = params.limit ?? LIST_IMAGES_DEFAULT_LIMIT;
    const records = await this.imageRepo.list({ cursor: params.cursor, limit });
    const images = records.map(toPublic);
    const last = records[records.length - 1];
    const nextCursor = records.length === limit && last ? last.createdAt.toISOString() : null;
    return { images, nextCursor };
  }

  /**
   * 全 active 画像からサーバーサイドでランダムに最大 `limit` 枚を抽出する。
   *
   * 表示中 16 枚のクライアントシャッフルではなく「母集団全体からの抽出」を満たすため、
   * 全 active id を取得 → サーバーで Fisher-Yates → 先頭 `limit` 件の本体を取得する。
   * `limit` 既定は #108 の共通定数 `LIST_IMAGES_DEFAULT_LIMIT` を参照する。
   *
   * - 総件数が `limit` 以下なら全件をランダム順で返す。
   * - `findManyActiveByIds` の返却順は不定なため、シャッフル順で再整列して
   *   表示順そのものをランダム化する。
   * - ページネーション (nextCursor) は持たない (ランダム順と created_at カーソル不整合)。
   */
  async listRandomImages(limit: number = LIST_IMAGES_DEFAULT_LIMIT): Promise<RandomImagesResult> {
    const ids = await this.imageRepo.listActiveIds();
    if (ids.length === 0) return { images: [] };

    const sampled = shuffle(ids).slice(0, limit);
    const records = await this.imageRepo.findManyActiveByIds(sampled);

    // sampled (シャッフル順) を表示順とし、取得行をその順に整列する。
    // findManyActiveByIds が一部 id を返さなかった場合 (取得と抽出の間に
    // 論理削除された等) は欠落分を素直に除外する。
    const byId = new Map(records.map((record) => [record.id, record]));
    const ordered = sampled
      .map((id) => byId.get(id))
      .filter((record): record is LgtmImage => record !== undefined);

    return { images: ordered.map(toPublic) };
  }
}

export function buildImageService(supabase: SupabaseClient<Database>): ImageService {
  return new ImageService({
    imageRepo: new ImageRepository(supabase),
    countRepo: new DailyUploadCountRepository(supabase),
  });
}
