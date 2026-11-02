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
  /**
   * `repo` が null のときはインフラ未準備（SERVICE_ROLE 未設定など）とみなし、
   * 制限せず通す。RPC / DB 障害時も同様に fail-open する。
   * 超過判定だけは厳守し RateLimitExceededError を再 throw する。
   */
  constructor(private readonly repo: RateLimitRepository | null) {}

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
    if (!this.repo) {
      return;
    }

    let allowed: boolean;
    try {
      allowed = await this.repo.consume(key, limit, windowSeconds);
    } catch (err) {
      // マイグレーション未適用・RPC 障害などで制限基盤が落ちても、
      // ランダム表示や登録 API 全体を 500 にしない（Issue #275 後の本番障害対策）。
      console.error('[RateLimitService] consume failed; fail-open', { key, err });
      return;
    }

    if (!allowed) {
      throw new RateLimitExceededError(windowSeconds);
    }
  }
}

export function buildRateLimitService(): RateLimitService {
  try {
    return new RateLimitService(new RateLimitRepository(createServiceRoleClient()));
  } catch (err) {
    console.error('[RateLimitService] service role client unavailable; fail-open', err);
    return new RateLimitService(null);
  }
}
