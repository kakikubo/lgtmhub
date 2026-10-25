import { describe, expect, it } from 'vitest';
import {
  buildKeysetOrFilter,
  encodeKeysetCursor,
  keysetCursorQuerySchema,
} from '@/src/lib/pagination/keyset-cursor';

const CURSOR = {
  createdAt: '2026-05-04T12:00:00.000Z',
  id: '00000000-0000-4000-8000-000000000001',
};

describe('encodeKeysetCursor', () => {
  it('JSON 文字列にエンコードする', () => {
    expect(encodeKeysetCursor(CURSOR)).toBe(JSON.stringify(CURSOR));
  });
});

describe('keysetCursorQuerySchema', () => {
  it('複合カーソル JSON を受理する', () => {
    const result = keysetCursorQuerySchema.safeParse(JSON.stringify(CURSOR));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(CURSOR);
    }
  });

  it('旧 ISO 単独カーソルを拒否する', () => {
    const result = keysetCursorQuerySchema.safeParse('2026-05-04T12:00:00.000Z');
    expect(result.success).toBe(false);
  });

  it('id が UUID でない JSON を拒否する', () => {
    const result = keysetCursorQuerySchema.safeParse(
      JSON.stringify({ createdAt: CURSOR.createdAt, id: 'not-a-uuid' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('buildKeysetOrFilter', () => {
  it('PostgREST の複合 keyset or フィルタを組む', () => {
    expect(buildKeysetOrFilter(CURSOR)).toBe(
      `created_at.lt."${CURSOR.createdAt}",and(created_at.eq."${CURSOR.createdAt}",id.lt.${CURSOR.id})`,
    );
  });
});
