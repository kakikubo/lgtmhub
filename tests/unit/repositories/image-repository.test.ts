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
