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
    is_animated: false,
    status: 'active',
    deleted_at: null,
    created_at: '2026-05-04T00:00:00.000Z',
    updated_at: '2026-05-04T00:00:00.000Z',
    ...overrides,
  };
}

interface SelectListResult {
  data: { id: string; p_hash: string }[] | null;
  error: { message: string } | null;
}

function createSelectListStub(result: SelectListResult): SupabaseClient<Database> {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient<Database>;
}

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
    or: ReturnType<typeof vi.fn>;
  };
}

function createListStub(result: ListResult): ListStub {
  // select → eq → order → order → limit (→ or) と繋いだ後に await するため、
  // 自身を返し続けつつ Promise としても解決できる chainable なスタブにする。
  const spies = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
  };
  const builder: Record<string, unknown> = {
    then: (
      onfulfilled?: (value: ListResult) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  for (const [name, spy] of Object.entries(spies)) {
    builder[name] = (...args: unknown[]) => {
      spy(...args);
      return builder;
    };
  }
  const from = vi.fn().mockReturnValue(builder);
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, ...spies } };
}

interface ActiveIdsResult {
  data: { id: string }[] | null;
  error: { message: string } | null;
}

interface ActiveIdsStub {
  client: SupabaseClient<Database>;
  spies: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
  };
}

function createActiveIdsStub(result: ActiveIdsResult): ActiveIdsStub {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, select, eq } };
}

describe('ImageRepository.listActiveIds', () => {
  it('status=active の id 配列を返す', async () => {
    const stub = createActiveIdsStub({
      data: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
      error: null,
    });
    const repo = new ImageRepository(stub.client);

    const ids = await repo.listActiveIds();

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.select).toHaveBeenCalledWith('id');
    expect(stub.spies.eq).toHaveBeenCalledWith('status', 'active');
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('行が空のときは空配列を返す', async () => {
    const stub = createActiveIdsStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    expect(await repo.listActiveIds()).toEqual([]);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const stub = createActiveIdsStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(stub.client);
    await expect(repo.listActiveIds()).rejects.toBeInstanceOf(DatabaseError);
  });
});

interface FindManyResult {
  data: Row[] | null;
  error: { message: string } | null;
}

interface FindManyStub {
  client: SupabaseClient<Database>;
  spies: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    inFn: ReturnType<typeof vi.fn>;
  };
}

function createFindManyStub(result: FindManyResult): FindManyStub {
  const inFn = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ in: inFn });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, select, eq, inFn } };
}

describe('ImageRepository.findManyActiveByIds', () => {
  it('ids が空のときは Supabase を呼ばず空配列を返す (空配列ガード)', async () => {
    const stub = createFindManyStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);

    expect(await repo.findManyActiveByIds([])).toEqual([]);
    expect(stub.spies.from).not.toHaveBeenCalled();
  });

  it('status=active を id in (...) で取得し camelCase で返す', async () => {
    const stub = createFindManyStub({
      data: [buildRow({ id: 'image-1' }), buildRow({ id: 'image-2' })],
      error: null,
    });
    const repo = new ImageRepository(stub.client);

    const results = await repo.findManyActiveByIds(['image-1', 'image-2']);

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.select).toHaveBeenCalledWith('*');
    expect(stub.spies.eq).toHaveBeenCalledWith('status', 'active');
    expect(stub.spies.inFn).toHaveBeenCalledWith('id', ['image-1', 'image-2']);
    expect(results.map((r) => r.id)).toEqual(['image-1', 'image-2']);
    expect(results[0]?.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('行が空のときは空配列を返す', async () => {
    const stub = createFindManyStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    expect(await repo.findManyActiveByIds(['x'])).toEqual([]);
  });

  it('error 時は DatabaseError を throw する', async () => {
    const stub = createFindManyStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(stub.client);
    await expect(repo.findManyActiveByIds(['x'])).rejects.toBeInstanceOf(DatabaseError);
  });
});

interface NeqStub {
  client: SupabaseClient<Database>;
  spies: {
    from: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    neq: ReturnType<typeof vi.fn>;
  };
}

function createListActivePHashesExceptStub(result: SelectListResult): NeqStub {
  const neq = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ neq });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, spies: { from, select, eq, neq } };
}

describe('ImageRepository.listActivePHashesExcept', () => {
  it('excludeId を neq で除外し、id + pHash を camelCase で返す', async () => {
    const stub = createListActivePHashesExceptStub({
      data: [{ id: 'b', p_hash: '1'.repeat(1024) }],
      error: null,
    });
    const repo = new ImageRepository(stub.client);

    const result = await repo.listActivePHashesExcept('a');

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.eq).toHaveBeenCalledWith('status', 'active');
    expect(stub.spies.neq).toHaveBeenCalledWith('id', 'a');
    expect(result).toEqual([{ id: 'b', pHash: '1'.repeat(1024) }]);
  });

  it('行が空のときは空配列', async () => {
    const stub = createListActivePHashesExceptStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    expect(await repo.listActivePHashesExcept('a')).toEqual([]);
  });

  it('error 時は DatabaseError', async () => {
    const stub = createListActivePHashesExceptStub({ data: null, error: { message: 'oops' } });
    const repo = new ImageRepository(stub.client);
    await expect(repo.listActivePHashesExcept('a')).rejects.toBeInstanceOf(DatabaseError);
  });
});
describe('ImageRepository.list', () => {
  it('cursor 無し: status=active を created_at desc, id desc で limit 件取得する', async () => {
    const stub = createListStub({ data: [buildRow({ id: 'image-1' })], error: null });
    const repo = new ImageRepository(stub.client);
    const results = await repo.list({ limit: 20 });

    expect(stub.spies.from).toHaveBeenCalledWith('lgtm_images');
    expect(stub.spies.select).toHaveBeenCalledWith('*');
    expect(stub.spies.eq).toHaveBeenCalledWith('status', 'active');
    expect(stub.spies.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(stub.spies.order).toHaveBeenCalledWith('id', { ascending: false });
    expect(stub.spies.limit).toHaveBeenCalledWith(20);
    expect(stub.spies.or).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('image-1');
    expect(results[0]?.createdAt).toEqual(new Date('2026-05-04T00:00:00.000Z'));
  });

  it('cursor 有り: 複合 keyset の or フィルタが呼ばれる', async () => {
    const cursor = {
      createdAt: '2026-05-04T00:00:00.000Z',
      id: '00000000-0000-4000-8000-000000000099',
    };
    const stub = createListStub({ data: [], error: null });
    const repo = new ImageRepository(stub.client);
    await repo.list({ limit: 5, cursor });
    expect(stub.spies.or).toHaveBeenCalledWith(
      `created_at.lt."${cursor.createdAt}",and(created_at.eq."${cursor.createdAt}",id.lt.${cursor.id})`,
    );
    expect(stub.spies.limit).toHaveBeenCalledWith(5);
  });

  it('同一 created_at の行がページ境界をまたいでも id で tie-break できるフィルタを組む', async () => {
    const sameTs = '2026-05-04T12:00:00.000Z';
    const cursor = {
      createdAt: sameTs,
      id: '00000000-0000-4000-8000-000000000002',
    };
    const stub = createListStub({
      data: [buildRow({ id: '00000000-0000-4000-8000-000000000001', created_at: sameTs })],
      error: null,
    });
    const results = await new ImageRepository(stub.client).list({ limit: 1, cursor });

    expect(stub.spies.or).toHaveBeenCalledWith(
      `created_at.lt."${sameTs}",and(created_at.eq."${sameTs}",id.lt.${cursor.id})`,
    );
    expect(results[0]?.id).toBe('00000000-0000-4000-8000-000000000001');
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
