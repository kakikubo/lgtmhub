import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, RateLimitExceededError } from '@/src/lib/errors';
import { createServiceRoleClient } from '@/src/lib/supabase/service';
import type { RateLimitRepository } from '@/src/repositories/rate-limit-repository';
import {
  buildRateLimitService,
  RANDOM_RATE_LIMIT,
  RateLimitService,
  REGENERATE_RATE_LIMIT,
  UPLOAD_IP_RATE_LIMIT,
  UPLOAD_USER_RATE_LIMIT,
} from '@/src/services/rate-limit-service';

vi.mock('@/src/lib/supabase/service', () => ({
  createServiceRoleClient: vi.fn(),
}));

function buildService(consume: ReturnType<typeof vi.fn>) {
  const repo = { consume } as unknown as RateLimitRepository;
  return new RateLimitService(repo);
}

describe('RateLimitService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it('repo が null なら制限せず通す', async () => {
    await expect(new RateLimitService(null).consumeRandom('203.0.113.5')).resolves.toBeUndefined();
  });

  it('RPC 障害時は fail-open し、超過エラーは再 throw する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = vi.fn().mockRejectedValue(new DatabaseError('function missing'));
    await expect(buildService(failing).consumeRandom('203.0.113.5')).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();

    const denied = vi.fn().mockResolvedValue(false);
    await expect(buildService(denied).consumeRandom('203.0.113.5')).rejects.toBeInstanceOf(
      RateLimitExceededError,
    );
  });

  it('SERVICE_ROLE 未設定でも buildRateLimitService は throw せず fail-open する', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(createServiceRoleClient).mockImplementation(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です');
    });

    const service = buildRateLimitService();
    await expect(service.consumeRandom('203.0.113.5')).resolves.toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
