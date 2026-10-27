import { describe, expect, it, vi } from 'vitest';
import { RateLimitExceededError } from '@/src/lib/errors';
import type { RateLimitRepository } from '@/src/repositories/rate-limit-repository';
import {
  RANDOM_RATE_LIMIT,
  RateLimitService,
  REGENERATE_RATE_LIMIT,
  UPLOAD_IP_RATE_LIMIT,
  UPLOAD_USER_RATE_LIMIT,
} from '@/src/services/rate-limit-service';

function buildService(consume: ReturnType<typeof vi.fn>) {
  const repo = { consume } as unknown as RateLimitRepository;
  return new RateLimitService(repo);
}

describe('RateLimitService', () => {
  it('ランダムは IP キーで消費する', async () => {
    const consume = vi.fn().mockResolvedValue(true);
    await buildService(consume).consumeRandom('203.0.113.5');
    expect(consume).toHaveBeenCalledWith(
      'random:ip:203.0.113.5',
      RANDOM_RATE_LIMIT.limit,
      RANDOM_RATE_LIMIT.windowSeconds,
    );
  });

  it('画像登録は IP 枠のあとユーザー枠を消費する', async () => {
    const consume = vi.fn().mockResolvedValue(true);
    await buildService(consume).consumeUpload('user-1', '203.0.113.5');
    expect(consume).toHaveBeenNthCalledWith(
      1,
      'upload:ip:203.0.113.5',
      UPLOAD_IP_RATE_LIMIT.limit,
      UPLOAD_IP_RATE_LIMIT.windowSeconds,
    );
    expect(consume).toHaveBeenNthCalledWith(
      2,
      'upload:user:user-1',
      UPLOAD_USER_RATE_LIMIT.limit,
      UPLOAD_USER_RATE_LIMIT.windowSeconds,
    );
  });

  it('IP 枠が超過したらユーザー枠は消費しない', async () => {
    const consume = vi.fn().mockResolvedValue(false);
    await expect(
      buildService(consume).consumeUpload('user-1', '203.0.113.5'),
    ).rejects.toBeInstanceOf(RateLimitExceededError);
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it('再生成はユーザーキーで消費し、超過時は Retry-After 付きで throw する', async () => {
    const consume = vi.fn().mockResolvedValue(false);
    const error = await buildService(consume)
      .consumeRegenerate('admin-1')
      .catch((err: unknown) => err);
    expect(error).toBeInstanceOf(RateLimitExceededError);
    if (!(error instanceof RateLimitExceededError)) {
      throw new Error('expected RateLimitExceededError');
    }
    expect(error.retryAfterSeconds).toBe(REGENERATE_RATE_LIMIT.windowSeconds);
    expect(consume).toHaveBeenCalledWith(
      'regenerate:user:admin-1',
      REGENERATE_RATE_LIMIT.limit,
      REGENERATE_RATE_LIMIT.windowSeconds,
    );
  });
});
