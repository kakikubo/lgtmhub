import { connection, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';

// 押下のたびに別の 16 枚を返す要件のため、ルート単位でもキャッシュさせない。
// cacheComponents 下では `export const dynamic` が非互換のため、`connection()` で明示的に
// dynamic 化して prerender を抑止する。レスポンスの `Cache-Control: no-store` で CDN キャッシュも抑止する。
export async function GET() {
  await connection();
  try {
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
    console.error('[GET /api/images/random]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
