import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError, ForbiddenError, NotFoundError } from '@/src/lib/errors';
import { ImageWriteRepository } from '@/src/repositories/image-write-repository';
import type { Database } from '@/src/types/database.types';

type Row = Database['public']['Tables']['lgtm_images']['Row'];

function buildRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'image-1',
    uploader_id: 'user-1',
    original_url: 'https://example.com/source.jpg',
    image_url: 'https://blob.example/x.webp',
    p_hash: '0'.repeat(1024),
    width: 800,
    height: 600,
    file_size_bytes: 12345,
    mime_type: 'image/webp',
    is_animated: false,
    status: 'active',
    deleted_at: null,
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  };
}

interface RpcResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

interface RpcStub {
  factory: ReturnType<typeof vi.fn<() => SupabaseClient<Database>>>;
  rpc: ReturnType<typeof vi.fn>;
}

// rpc() の戻り値は await しても .single() / .maybeSingle() を繋いでもよい形にする
function createRpcStub(result: RpcResult): RpcStub {
  const builder = {
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: RpcResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  const rpc = vi.fn().mockReturnValue(builder);
  const client = { rpc } as unknown as SupabaseClient<Database>;
  const factory = vi.fn<() => SupabaseClient<Database>>().mockReturnValue(client);
  return { factory, rpc };
}

const createInput = {
  uploaderId: 'user-1',
  originalUrl: 'https://example.com/source.jpg',
  imageUrl: 'https://blob.example/x.webp',
  pHash: '0'.repeat(1024),
  width: 800,
  height: 600,
  fileSizeBytes: 12345,
  mimeType: 'image/webp',
  isAnimated: false,
};

const regeneratePatch = {
  imageUrl: 'https://blob.example/new.webp',
  pHash: 'b'.repeat(1024),
  width: 400,
  height: 300,
  fileSizeBytes: 4,
  isAnimated: false,
};

describe('ImageWriteRepository のクライアント生成', () => {
  it('書き込みまでクライアントを生成せず、2 回目以降は使い回す', async () => {
    const stub = createRpcStub({ data: 1, error: null });
    const repo = new ImageWriteRepository(stub.factory);
    expect(stub.factory).not.toHaveBeenCalled();

    await repo.softDelete('image-1', 'user-1');
    await repo.softDelete('image-2', 'user-1');

    expect(stub.factory).toHaveBeenCalledTimes(1);
  });

  it('クライアント生成が失敗したら書き込みも失敗する (fail-closed)', async () => {
    const repo = new ImageWriteRepository(() => {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定です');
    });

    await expect(repo.softDelete('image-1', 'user-1')).rejects.toThrow(
      'SUPABASE_SERVICE_ROLE_KEY が未設定です',
    );
  });
});

describe('ImageWriteRepository.create', () => {
  it('create_lgtm_image RPC を呼び、LgtmImage を camelCase で返す', async () => {
    const stub = createRpcStub({ data: buildRow(), error: null });
    const repo = new ImageWriteRepository(stub.factory);

    const created = await repo.create(createInput);

    expect(stub.rpc).toHaveBeenCalledWith('create_lgtm_image', {
      p_uploader_id: 'user-1',
      p_original_url: 'https://example.com/source.jpg',
      p_image_url: 'https://blob.example/x.webp',
      p_p_hash: '0'.repeat(1024),
      p_width: 800,
      p_height: 600,
      p_file_size_bytes: 12345,
      p_mime_type: 'image/webp',
      p_is_animated: false,
    });
    expect(created.id).toBe('image-1');
    expect(created.uploaderId).toBe('user-1');
    expect(created.status).toBe('active');
    expect(created.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('error が返れば DatabaseError を throw する', async () => {
    const stub = createRpcStub({ data: null, error: { message: 'boom' } });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(repo.create(createInput)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('data が空のときは DatabaseError', async () => {
    const stub = createRpcStub({ data: null, error: null });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(repo.create(createInput)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('ImageWriteRepository.softDelete', () => {
  it('soft_delete_lgtm_image RPC に id と uploader を渡し、更新行数を返す', async () => {
    const stub = createRpcStub({ data: 1, error: null });
    const repo = new ImageWriteRepository(stub.factory);

    expect(await repo.softDelete('image-1', 'user-1')).toBe(1);
    expect(stub.rpc).toHaveBeenCalledWith('soft_delete_lgtm_image', {
      p_id: 'image-1',
      p_uploader_id: 'user-1',
    });
  });

  it('該当行が無い (他人 / 既削除 / 不正 ID) なら 0 を返す', async () => {
    const stub = createRpcStub({ data: 0, error: null });
    const repo = new ImageWriteRepository(stub.factory);

    expect(await repo.softDelete('image-1', 'user-1')).toBe(0);
  });

  it('数値以外が返れば DatabaseError', async () => {
    const stub = createRpcStub({ data: null, error: null });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(repo.softDelete('image-1', 'user-1')).rejects.toBeInstanceOf(DatabaseError);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const stub = createRpcStub({ data: null, error: { message: 'boom' } });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(repo.softDelete('image-1', 'user-1')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('ImageWriteRepository.updateAfterRegenerate', () => {
  it('requesterId を含めて RPC を呼び、更新後の行を返す (originalUrl 未指定は undefined)', async () => {
    const stub = createRpcStub({
      data: buildRow({ image_url: 'https://blob.example/new.webp' }),
      error: null,
    });
    const repo = new ImageWriteRepository(stub.factory);

    const updated = await repo.updateAfterRegenerate('image-1', 'admin-1', regeneratePatch);

    expect(stub.rpc).toHaveBeenCalledWith('update_lgtm_image_after_regenerate', {
      p_id: 'image-1',
      p_requester_id: 'admin-1',
      p_image_url: 'https://blob.example/new.webp',
      p_p_hash: 'b'.repeat(1024),
      p_width: 400,
      p_height: 300,
      p_file_size_bytes: 4,
      p_is_animated: false,
      p_original_url: undefined,
    });
    expect(updated.imageUrl).toBe('https://blob.example/new.webp');
  });

  it('originalUrl 指定時は p_original_url に渡す', async () => {
    const stub = createRpcStub({ data: buildRow(), error: null });
    const repo = new ImageWriteRepository(stub.factory);

    await repo.updateAfterRegenerate('image-1', 'admin-1', {
      ...regeneratePatch,
      originalUrl: 'https://example.com/replaced.jpg',
    });

    expect(stub.rpc.mock.calls[0]?.[1]).toMatchObject({
      p_original_url: 'https://example.com/replaced.jpg',
    });
  });

  it('該当行が無い (status=deleted / 存在しない) なら NotFoundError', async () => {
    const stub = createRpcStub({ data: null, error: null });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(
      repo.updateAfterRegenerate('image-1', 'admin-1', regeneratePatch),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('RPC が 42501 (非管理者) を返したら ForbiddenError', async () => {
    const stub = createRpcStub({ data: null, error: { message: 'forbidden', code: '42501' } });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(
      repo.updateAfterRegenerate('image-1', 'user-1', regeneratePatch),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('その他の error は DatabaseError', async () => {
    const stub = createRpcStub({ data: null, error: { message: 'boom' } });
    const repo = new ImageWriteRepository(stub.factory);

    await expect(
      repo.updateAfterRegenerate('image-1', 'admin-1', regeneratePatch),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});
