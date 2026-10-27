import { RateLimitExceededError } from '@/src/lib/errors';
import { createServiceRoleClient } from '@/src/lib/supabase/service';
import { RateLimitRepository } from '@/src/repositories/rate-limit-repository';

/** ランダム表示は人手の連打を通し、スクレイピングだけを止める。 */
export const RANDOM_RATE_LIMIT = { limit: 30, windowSeconds: 60 } as const;
/** 画像登録は sharp 合成を伴う。1 ユーザーの並列実行を日次上限より小さく抑える。 */
export const UPLOAD_USER_RATE_LIMIT = { limit: 5, windowSeconds: 60 } as const;
/** 同一 IP からの複数アカウント登録を抑える。NAT 共有を見込んでユーザー枠より緩い。 */
export const UPLOAD_IP_RATE_LIMIT = { limit: 20, windowSeconds: 60 } as const;
/** 再生成も合成コストが同じなので、登録と同じユーザー枠にする。 */
export const REGENERATE_RATE_LIMIT = { limit: 5, windowSeconds: 60 } as const;

export class RateLimitService {
  constructor(private readonly repo: RateLimitRepository) {}

  async consumeRandom(ip: string): Promise<void> {
    await this.consume(`random:ip:${ip}`, RANDOM_RATE_LIMIT.limit, RANDOM_RATE_LIMIT.windowSeconds);
  }

  async consumeUpload(userId: string, ip: string): Promise<void> {
    await this.consume(
      `upload:ip:${ip}`,
      UPLOAD_IP_RATE_LIMIT.limit,
      UPLOAD_IP_RATE_LIMIT.windowSeconds,
    );
    await this.consume(
      `upload:user:${userId}`,
      UPLOAD_USER_RATE_LIMIT.limit,
      UPLOAD_USER_RATE_LIMIT.windowSeconds,
    );
  }

  async consumeRegenerate(userId: string): Promise<void> {
    await this.consume(
      `regenerate:user:${userId}`,
      REGENERATE_RATE_LIMIT.limit,
      REGENERATE_RATE_LIMIT.windowSeconds,
    );
  }

  private async consume(key: string, limit: number, windowSeconds: number): Promise<void> {
    const allowed = await this.repo.consume(key, limit, windowSeconds);
    if (!allowed) {
      throw new RateLimitExceededError(windowSeconds);
    }
  }
}

export function buildRateLimitService(): RateLimitService {
  return new RateLimitService(new RateLimitRepository(createServiceRoleClient()));
}
