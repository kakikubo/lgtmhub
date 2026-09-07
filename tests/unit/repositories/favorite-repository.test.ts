import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { DatabaseError, DuplicateFavoriteError, NotFoundError } from '@/src/lib/errors';
import { FavoriteRepository } from '@/src/repositories/favorite-repository';
import type { Database } from '@/src/types/database.types';

type Row = Database['public']['Tables']['favorites']['Row'];

const USER_ID = 'user-1';
const IMAGE_ID = 'image-1';

function buildRow(overrides: Partial<Row> = {}): Row {
  return {
    id: 'fav-1',
    user_id: USER_ID,
    lgtm_image_id: IMAGE_ID,
    created_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

interface PostgrestErrorLike {
  message: string;
  code?: string;
}

function createInsertStub(result: { data: Row | null; error: PostgrestErrorLike | null }) {
  const single = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  const from = vi.fn().mockReturnValue({ insert });
  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    from,
    insert,
  };
}

function createDeleteStub(result: {
  data: { id: string }[] | null;
  error: PostgrestErrorLike | null;
}) {
  const select = vi.fn().mockResolvedValue(result);
  const eqImage = vi.fn().mockReturnValue({ select });
  const eqUser = vi.fn().mockReturnValue({ eq: eqImage });
  const del = vi.fn().mockReturnValue({ eq: eqUser });
  const from = vi.fn().mockReturnValue({ delete: del });
  return {
    supabase: { from } as unknown as SupabaseClient<Database>,
    eqUser,
    eqImage,
  };
}

interface EmbeddedRow {
  created_at: string;
  lgtm_images: {
    id: string;
    image_url: string;
    uploader_id: string;
    width: number;
    height: number;
    is_animated: boolean;
  };
}

function buildEmbeddedRow(overrides: Partial<EmbeddedRow> = {}): EmbeddedRow {
  return {
    created_at: '2026-08-20T00:00:00.000Z',
    lgtm_images: {
      id: IMAGE_ID,
      image_url: 'https://blob.example.com/lgtm/image-1.webp',
      uploader_id: 'uploader-1',
      width: 266,
      height: 199,
      is_animated: false,
    },
    ...overrides,
  };
}

/**
 * listWithImages は select → eq → eq → order → limit (→ lt) と繋いだ後に await するため、
 * 自身を返し続けつつ Promise としても解決できる chainable なスタブを用意する。
 */
function createListStub(result: { data: EmbeddedRow[] | null; error: PostgrestErrorLike | null }) {
  const calls = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    lt: vi.fn(),
  };
  const builder: Record<string, unknown> = {
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const [name, spy] of Object.entries(calls)) {
    builder[name] = (...args: unknown[]) => {
      spy(...args);
      return builder;
    };
  }
  const from = vi.fn().mockReturnValue(builder);
  return { supabase: { from } as unknown as SupabaseClient<Database>, from, calls };
}

function createSelectIdsStub(result: {
  data: { lgtm_image_id: string }[] | null;
  error: PostgrestErrorLike | null;
}) {
  const eq = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { supabase: { from } as unknown as SupabaseClient<Database>, eq };
}

describe('FavoriteRepository.create', () => {
  it('成功時に Favorite を camelCase で返す', async () => {
    const { supabase, from, insert } = createInsertStub({ data: buildRow(), error: null });
    const repo = new FavoriteRepository(supabase);

    const created = await repo.create(USER_ID, IMAGE_ID);

    expect(from).toHaveBeenCalledWith('favorites');
    expect(insert).toHaveBeenCalledWith({ user_id: USER_ID, lgtm_image_id: IMAGE_ID });
    expect(created).toEqual({
      id: 'fav-1',
      userId: USER_ID,
      lgtmImageId: IMAGE_ID,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
  });

  it('UNIQUE 違反 (23505) は DuplicateFavoriteError に変換する', async () => {
    const { supabase } = createInsertStub({
      data: null,
      error: { message: 'duplicate key value', code: '23505' },
    });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.create(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(DuplicateFavoriteError);
  });

  it('FK 違反 (23503) は NotFoundError に変換する', async () => {
    const { supabase } = createInsertStub({
      data: null,
      error: { message: 'foreign key violation', code: '23503' },
    });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.create(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('その他の error は DatabaseError に変換する', async () => {
    const { supabase } = createInsertStub({
      data: null,
      error: { message: 'rls violation', code: '42501' },
    });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.create(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(DatabaseError);
  });

  it('error なしで data が空なら DatabaseError', async () => {
    const { supabase } = createInsertStub({ data: null, error: null });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.create(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('FavoriteRepository.delete', () => {
  it('削除行数を返し、user_id と lgtm_image_id の両方で絞る', async () => {
    const { supabase, eqUser, eqImage } = createDeleteStub({
      data: [{ id: 'fav-1' }],
      error: null,
    });
    const repo = new FavoriteRepository(supabase);

    const deleted = await repo.delete(USER_ID, IMAGE_ID);

    expect(deleted).toBe(1);
    expect(eqUser).toHaveBeenCalledWith('user_id', USER_ID);
    expect(eqImage).toHaveBeenCalledWith('lgtm_image_id', IMAGE_ID);
  });

  it('該当が無ければ 0 を返す', async () => {
    const { supabase } = createDeleteStub({ data: [], error: null });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.delete(USER_ID, IMAGE_ID)).resolves.toBe(0);
  });

  it('data が null でも 0 を返す', async () => {
    const { supabase } = createDeleteStub({ data: null, error: null });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.delete(USER_ID, IMAGE_ID)).resolves.toBe(0);
  });

  it('error が返れば DatabaseError', async () => {
    const { supabase } = createDeleteStub({ data: null, error: { message: 'boom' } });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.delete(USER_ID, IMAGE_ID)).rejects.toBeInstanceOf(DatabaseError);
  });
});

describe('FavoriteRepository.listWithImages', () => {
  it('createdAt にお気に入り登録日時を詰めた画像を返す', async () => {
    const { supabase, calls } = createListStub({ data: [buildEmbeddedRow()], error: null });
    const repo = new FavoriteRepository(supabase);

    const rows = await repo.listWithImages({ userId: USER_ID, limit: 20 });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.image).toEqual({
      id: IMAGE_ID,
      imageUrl: 'https://blob.example.com/lgtm/image-1.webp',
      uploaderId: 'uploader-1',
      width: 266,
      height: 199,
      isAnimated: false,
      createdAt: new Date('2026-08-20T00:00:00.000Z'),
    });
    expect(rows[0]?.favoritedAt).toEqual(new Date('2026-08-20T00:00:00.000Z'));
    expect(calls.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(calls.limit).toHaveBeenCalledWith(20);
  });

  it('lgtm_images!inner と status=active で論理削除済みを除外する', async () => {
    const { supabase, calls } = createListStub({ data: [], error: null });
    const repo = new FavoriteRepository(supabase);

    await repo.listWithImages({ userId: USER_ID, limit: 20 });

    expect(calls.select.mock.calls[0]?.[0]).toContain('lgtm_images!inner');
    expect(calls.eq).toHaveBeenCalledWith('user_id', USER_ID);
    expect(calls.eq).toHaveBeenCalledWith('lgtm_images.status', 'active');
  });

  it('cursor 指定時のみ created_at の lt フィルタを付ける', async () => {
    const withCursor = createListStub({ data: [], error: null });
    await new FavoriteRepository(withCursor.supabase).listWithImages({
      userId: USER_ID,
      limit: 20,
      cursor: '2026-08-19T00:00:00.000Z',
    });
    expect(withCursor.calls.lt).toHaveBeenCalledWith('created_at', '2026-08-19T00:00:00.000Z');

    const withoutCursor = createListStub({ data: [], error: null });
    await new FavoriteRepository(withoutCursor.supabase).listWithImages({
      userId: USER_ID,
      limit: 20,
    });
    expect(withoutCursor.calls.lt).not.toHaveBeenCalled();
  });

  it('data が null なら空配列を返す', async () => {
    const { supabase } = createListStub({ data: null, error: null });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.listWithImages({ userId: USER_ID, limit: 20 })).resolves.toEqual([]);
  });

  it('error が返れば DatabaseError', async () => {
    const { supabase } = createListStub({ data: null, error: { message: 'join boom' } });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.listWithImages({ userId: USER_ID, limit: 20 })).rejects.toBeInstanceOf(
      DatabaseError,
    );
  });
});

describe('FavoriteRepository.listImageIds', () => {
  it('自分のお気に入り画像 ID を返す', async () => {
    const { supabase, eq } = createSelectIdsStub({
      data: [{ lgtm_image_id: 'a' }, { lgtm_image_id: 'b' }],
      error: null,
    });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.listImageIds(USER_ID)).resolves.toEqual(['a', 'b']);
    expect(eq).toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('data が null なら空配列を返す', async () => {
    const { supabase } = createSelectIdsStub({ data: null, error: null });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.listImageIds(USER_ID)).resolves.toEqual([]);
  });

  it('error が返れば DatabaseError', async () => {
    const { supabase } = createSelectIdsStub({ data: null, error: { message: 'boom' } });
    const repo = new FavoriteRepository(supabase);

    await expect(repo.listImageIds(USER_ID)).rejects.toBeInstanceOf(DatabaseError);
  });
});
