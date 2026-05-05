import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError } from '@/src/lib/errors';
import { ImageRepository } from '@/src/repositories/image-repository';
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
    status: 'active',
    deleted_at: null,
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  };
}

interface InsertResult {
  data: Row | null;
  error: { message: string } | null;
}

interface SelectListResult {
  data: { id: string; p_hash: string }[] | null;
  error: { message: string } | null;
}

function createInsertStub(result: InsertResult): SupabaseClient<Database> {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return { from } as unknown as SupabaseClient<Database>;
}

function createSelectListStub(result: SelectListResult): SupabaseClient<Database> {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient<Database>;
}

describe('ImageRepository.create', () => {
  it('成功時に LgtmImage を camelCase で返す', async () => {
    const supabase = createInsertStub({ data: buildRow(), error: null });
    const repo = new ImageRepository(supabase);

    const created = await repo.create({
      uploaderId: 'user-1',
      originalUrl: 'https://example.com/source.jpg',
      imageUrl: 'https://blob.example/x.webp',
      pHash: '0'.repeat(1024),
      width: 800,
      height: 600,
      fileSizeBytes: 12345,
      mimeType: 'image/webp',
    });

    expect(created.id).toBe('image-1');
    expect(created.uploaderId).toBe('user-1');
    expect(created.imageUrl).toBe('https://blob.example/x.webp');
    expect(created.status).toBe('active');
    expect(created.deletedAt).toBeNull();
    expect(created.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('error が返れば DatabaseError を throw する', async () => {
    const supabase = createInsertStub({ data: null, error: { message: 'rls violation' } });
    const repo = new ImageRepository(supabase);

    await expect(
      repo.create({
        uploaderId: 'user-1',
        originalUrl: 'https://example.com/source.jpg',
        imageUrl: 'https://blob.example/x.webp',
        pHash: '0'.repeat(1024),
        width: 800,
        height: 600,
        fileSizeBytes: 12345,
        mimeType: 'image/webp',
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
  });

  it('data が空のときは DatabaseError', async () => {
    const supabase = createInsertStub({ data: null, error: null });
    const repo = new ImageRepository(supabase);
    await expect(
      repo.create({
        uploaderId: 'user-1',
        originalUrl: 'https://example.com/source.jpg',
        imageUrl: 'https://blob.example/x.webp',
        pHash: '0'.repeat(1024),
        width: 800,
        height: 600,
        fileSizeBytes: 12345,
        mimeType: 'image/webp',
      }),
    ).rejects.toBeInstanceOf(DatabaseError);
  });
});

interface MaybeSingleResult {
  data: Row | null;
  error: { message: string } | null;
}

interface MaybeSingleStub {
  client: SupabaseClient<Database>;
  spies: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eqId: ReturnType<typeof vi.fn>;
    eqStatus: ReturnType<typeof vi.fn>;
    maybeSingle: ReturnType<typeof vi.fn>;
  };
}

function createMaybeSingleStub(result: MaybeSingleResult): MaybeSingleStub {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eqStatus = vi.fn().mockReturnValue({ maybeSingle });
  const eqId = vi.fn().mockReturnValue({ eq: eqStatus });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, select, eqId, eqStatus, maybeSingle } };
}

describe('ImageRepository.findActiveById', () => {
  it('行が存在する場合は LgtmImage を camelCase で返す', async () => {
    const stub = createMaybeSingleStub({ data: buildRow({ id: 'image-1' }), error: null });
    const repo = new ImageRepository(stub.client);

    const result = await repo.findActiveById('image-1');

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.eqId).toHaveBeenCalledWith('id', 'image-1');
    expect(stub.spies.eqStatus).toHaveBeenCalledWith('status', 'active');
    expect(result?.id).toBe('image-1');
    expect(result?.uploaderId).toBe('user-1');
    expect(result?.imageUrl).toBe('https://blob.example/x.webp');
    expect(result?.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('行が存在しない (= 不正 ID / status=deleted) 場合は null を返す', async () => {
    const stub = createMaybeSingleStub({ data: null, error: null });
    const repo = new ImageRepository(stub.client);

    expect(await repo.findActiveById('missing')).toBeNull();
  });

  it('error 時は DatabaseError を throw する', async () => {
    const stub = createMaybeSingleStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(stub.client);

    await expect(repo.findActiveById('image-1')).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('ImageRepository.listActivePHashes', () => {
  it('id と pHash を camelCase で返す', async () => {
    const supabase = createSelectListStub({
      data: [
        { id: 'a', p_hash: '0'.repeat(1024) },
        { id: 'b', p_hash: '1'.repeat(1024) },
      ],
      error: null,
    });
    const repo = new ImageRepository(supabase);
    const results = await repo.listActivePHashes();
    expect(results).toEqual([
      { id: 'a', pHash: '0'.repeat(1024) },
      { id: 'b', pHash: '1'.repeat(1024) },
    ]);
  });

  it('行が空のときは空配列', async () => {
    const supabase = createSelectListStub({ data: [], error: null });
    const repo = new ImageRepository(supabase);
    expect(await repo.listActivePHashes()).toEqual([]);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const supabase = createSelectListStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(supabase);
    await expect(repo.listActivePHashes()).rejects.toBeInstanceOf(DatabaseError);
  });
});

interface ListResult {
  data: Row[] | null;
  error: { message: string } | null;
}

interface ListStub {
  client: SupabaseClient<Database>;
  spies: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    lt: ReturnType<typeof vi.fn>;
  };
}

function createListStub(result: ListResult): ListStub {
  const lt = vi.fn().mockResolvedValue(result);
  // limit の戻り値は (cursor 無しの) await 解決値 と (cursor 有りの) 次の chain の両方を兼ねる:
  // 1. await query (=limit の解決) → ListResult
  // 2. query.lt(...) → ListResult
  // PromiseLike を返しつつ lt メソッドを持つオブジェクトにすることで両対応する
  const limitReturn: { lt: typeof lt; then: PromiseLike<ListResult>['then'] } = {
    lt,
    then: (onfulfilled, onrejected) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  const limit = vi.fn().mockReturnValue(limitReturn);
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, select, eq, order, limit, lt } };
}

describe('ImageRepository.list', () => {
  it('cursor 無し: status=active を created_at desc で limit 件取得する', async () => {
    const stub = createListStub({ data: [buildRow({ id: 'image-1' })], error: null });
    const repo = new ImageRepository(stub.client);
    const results = await repo.list({ limit: 20 });

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.select).toHaveBeenCalledWith('*');
    expect(stub.spies.eq).toHaveBeenCalledWith('status', 'active');
    expect(stub.spies.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(stub.spies.limit).toHaveBeenCalledWith(20);
    expect(stub.spies.lt).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('image-1');
    expect(results[0]?.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('cursor 有り: lt("created_at", cursor) が呼ばれる', async () => {
    const stub = createListStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    await repo.list({ limit: 5, cursor: '2026-05-04T00:00:00.000Z' });
    expect(stub.spies.lt).toHaveBeenCalledWith('created_at', '2026-05-04T00:00:00.000Z');
    expect(stub.spies.limit).toHaveBeenCalledWith(5);
  });

  it('行が空のときは空配列を返す', async () => {
    const stub = createListStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    expect(await repo.list({ limit: 20 })).toEqual([]);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const stub = createListStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(stub.client);
    await expect(repo.list({ limit: 20 })).rejects.toBeInstanceOf(DatabaseError);
  });
});
