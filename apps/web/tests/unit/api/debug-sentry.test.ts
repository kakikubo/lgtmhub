import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@/src/lib/errors';

const requireAdmin = vi.fn();

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  connection: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/src/lib/auth/require-admin', () => ({
  requireAdmin: (...args: unknown[]) => requireAdmin(...args),
}));

beforeEach(() => {
  requireAdmin.mockReset();
});

describe('GET /api/debug-sentry', () => {
  it('未ログインなら例外を投げずに 401 を返す', async () => {
    requireAdmin.mockRejectedValue(new UnauthorizedError());
    const { GET } = await import('@/app/api/debug-sentry/route');

    const res = await GET();

    expect(res.status).toBe(401);
  });

  it('管理者でなければ例外を投げずに 403 を返す', async () => {
    requireAdmin.mockRejectedValue(new ForbiddenError());
    const { GET } = await import('@/app/api/debug-sentry/route');

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it('管理者なら SentryDebugError を投げる', async () => {
    requireAdmin.mockResolvedValue({ userId: 'admin' });
    const { GET } = await import('@/app/api/debug-sentry/route');

    await expect(GET()).rejects.toThrow('Sentry 疎通確認用のエラー');
  });
});
