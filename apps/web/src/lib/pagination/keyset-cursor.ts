// スキーマ生成より前に jitless を効かせる (Issue #276)。必ず先頭に置く。
import '@/src/lib/validation/zod-config';
import { z } from 'zod';

/**
 * (created_at, id) 複合 keyset ページネーション用カーソル。
 * 同一 created_at の行がページ境界をまたいでも欠落・重複しないようにする (Issue #327)。
 */
export interface KeysetCursor {
  createdAt: string;
  id: string;
}

export const keysetCursorObjectSchema = z.object({
  createdAt: z
    .string()
    .datetime({ message: 'cursor.createdAt は ISO 8601 形式で指定してください' }),
  id: z.string().uuid({ message: 'cursor.id は UUID で指定してください' }),
});

/**
 * クエリパラメータ / nextCursor ワイヤ形式の JSON 文字列を KeysetCursor に変換する。
 * 旧 ISO 単独カーソルは受理しない (破壊的変更を明示)。
 */
export const keysetCursorQuerySchema = z.string().transform((raw, ctx): KeysetCursor => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    ctx.addIssue({
      code: 'custom',
      message: 'cursor は { createdAt, id } の JSON で指定してください',
    });
    return z.NEVER;
  }

  const result = keysetCursorObjectSchema.safeParse(parsed);
  if (!result.success) {
    ctx.addIssue({
      code: 'custom',
      message: result.error.issues[0]?.message ?? 'cursor が不正です',
    });
    return z.NEVER;
  }
  return result.data;
});

export function encodeKeysetCursor(cursor: KeysetCursor): string {
  return JSON.stringify(cursor);
}

/**
 * PostgREST `.or()` 用の複合 keyset フィルタ文字列を返す。
 * 意味: created_at < X OR (created_at = X AND id < Y)
 *
 * タイムスタンプは `:` を含むため二重引用符で囲む。
 */
export function buildKeysetOrFilter(cursor: KeysetCursor): string {
  const ts = `"${cursor.createdAt}"`;
  return `created_at.lt.${ts},and(created_at.eq.${ts},id.lt.${cursor.id})`;
}
