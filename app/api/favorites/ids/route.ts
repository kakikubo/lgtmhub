import { connection, NextResponse } from 'next/server';
import { AppError, UnauthorizedError } from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { buildFavoriteService } from '@/src/services/favorite-service';

/**
 * 自分がお気に入り登録済みの画像 ID 一覧を返す。
 *
 * トップの一覧は 'use cache' で匿名キャッシュされ、「もっと読み込む」「ランダム表示」は
 * クライアント fetch でカードを増やすため、サーバー側でユーザー固有のハート状態を埋め込めない。
 * クライアントが 1 セッションに 1 度だけこれを取得し、ハートの初期状態を決める。
 *
 * 未ログインは 401 を返す。クライアントはこれを「未ログイン」の判定に使い、
 * ハート押下時に GitHub ログインへ誘導する。
 *
 * 静的セグメント `ids` は動的セグメント `[lgtmImageId]` より優先されるため、
 * DELETE /api/favorites/:lgtmImageId とルートが衝突することはない。
 */
export async function GET() {
  // cacheComponents 下では `export const dynamic` が非互換のため connection() で prerender を抑止する
  // (app/api/images/random/route.ts と同方針)。
  await connection();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const service = buildFavoriteService(supabase);
    const lgtmImageIds = await service.listFavoriteImageIds(user.id);

    return NextResponse.json(
      { lgtmImageIds },
      { status: 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[GET /api/favorites/ids] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[GET /api/favorites/ids]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
