import { connection, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/lib/auth/require-admin';
import { ForbiddenError, UnauthorizedError } from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';

// route ファイルは HTTP メソッド以外を export できないため非公開にする
class SentryDebugError extends Error {
  constructor() {
    super('Sentry 疎通確認用のエラー (/api/debug-sentry)');
    this.name = 'SentryDebugError';
  }
}

// 本番で Sentry への記録と Slack 通知を確認するための意図的なエラー (Issue #175)。
// 誰でも叩けると無料枠を消費されるため管理者に限定し、検証後もこの制限で残す
export async function GET() {
  await connection();
  const supabase = await createClient();

  try {
    await requireAdmin(supabase);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    throw err;
  }

  // catch せずに投げ、onRequestError (instrumentation.ts) 経由で Sentry に送らせる
  throw new SentryDebugError();
}
