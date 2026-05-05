import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DatabaseError, ForbiddenError, NotFoundError } from '@/src/lib/errors';

const createClient = vi.fn();
const buildImageService = vi.fn();

vi.mock('@/src/lib/supabase/server', () => ({
  createClient: () => createClient(),
}));

vi.mock('@/src/services/image-service', () => ({
  buildImageService: () => buildImageService(),
}));

interface AuthState {
  user: { id: string } | null;
}

function buildSupabase(auth: AuthState) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: auth.user } }),
    },
  };
}

// zod v4 の z.string().uuid() は UUID v1-v8 のみ受け付ける厳密版。version=4 / variant=8 のサンプルを使う
const VALID_UUID = '00000000-0000-4000-8000-000000000001';

beforeEach(() => {
  createClient.mockReset();
  buildImageService.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callDelete(id: string) {
  const { DELETE } = await import('@/app/api/images/[id]/route');
  // 第 1 引数は使わないので最小モック
  const request = new Request(`http://localhost/api/images/${id}`, { method: 'DELETE' });
  return DELETE(request as never, { params: Promise.resolve({ id }) });
}

describe('DELETE /api/images/[id]', () => {
  it('id が UUID 形式でなければ 400 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callDelete('not-a-uuid');

    expect(res.status).toBe(400);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('未ログインなら 401 を返す', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: null }));

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(401);
    expect(buildImageService).not.toHaveBeenCalled();
  });

  it('成功時は 204 を返し Service.deleteImage(id, userId) を呼ぶ', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    const deleteImage = vi.fn().mockResolvedValue(undefined);
    buildImageService.mockReturnValue({ deleteImage });

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(204);
    expect(deleteImage).toHaveBeenCalledWith(VALID_UUID, 'user-1');
  });

  it('Service が NotFoundError を投げたら 404', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildImageService.mockReturnValue({
      deleteImage: vi.fn().mockRejectedValue(new NotFoundError('画像', VALID_UUID)),
    });

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(404);
  });

  it('Service が ForbiddenError を投げたら 403', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildImageService.mockReturnValue({
      deleteImage: vi.fn().mockRejectedValue(new ForbiddenError()),
    });

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(403);
  });

  it('Service が想定外のエラーを投げたら 500', async () => {
    createClient.mockResolvedValue(buildSupabase({ user: { id: 'user-1' } }));
    buildImageService.mockReturnValue({
      deleteImage: vi.fn().mockRejectedValue(new DatabaseError('db boom')),
    });

    // console.error をミュート
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await callDelete(VALID_UUID);

    expect(res.status).toBe(500);
    consoleErrorSpy.mockRestore();
  });
});
