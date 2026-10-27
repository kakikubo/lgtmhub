import { connection, type NextRequest, NextResponse } from 'next/server';
import { RateLimitExceededError } from '@/src/lib/errors';
import { clientIp } from '@/src/lib/http/client-ip';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';
import { buildRateLimitService } from '@/src/services/rate-limit-service';

// 押下のたびに別の 16 枚を返す要件のため、ルート単位でもキャッシュさせない。
// cacheComponents 下では `export const dynamic` が非互換のため、`connection()` で明示的に
// dynamic 化して prerender を抑止する。レスポンスの `Cache-Control: no-store` で CDN キャッシュも抑止する。
export async function GET(request: NextRequest) {
  await connection();
  try {
    await buildRateLimitService().consumeRandom(clientIp(request.headers));

    // ログイン不要。RLS ポリシー (anyone can view active images) 経由で
    // anon ロールでも status='active' を SELECT できる (GET /api/images と同方針)。
    const supabase = await createClient();
    const service = buildImageService(supabase);
    const result = await service.listRandomImages();

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    if (err instanceof RateLimitExceededError) {
      return NextResponse.json(
        { error: err.message },
        {
          status: 429,
          headers: {
            'Cache-Control': 'no-store',
            'Retry-After': String(err.retryAfterSeconds),
          },
        },
      );
    }
    console.error('[GET /api/images/random]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
