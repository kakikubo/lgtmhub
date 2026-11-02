import { type NextRequest, NextResponse } from 'next/server';
import {
  AppError,
  DuplicateFavoriteError,
  NotFoundError,
  UnauthorizedError,
} from '@/src/lib/errors';
import { PRIVATE_CACHE_HEADERS } from '@/src/lib/http/cache-headers';
import { createClient } from '@/src/lib/supabase/server';
import {
  createFavoriteRequestSchema,
  listFavoritesQuerySchema,
} from '@/src/lib/validation/favorite';
import { buildFavoriteService } from '@/src/services/favorite-service';

// お気に入りはユーザー固有の非公開データなので、CDN / 共有キャッシュに載せない。
// GET /api/images と違い createAnonClient() は使えず (RLS が auth.uid() を要求する)、
// Cookie 連携の createClient() を使う。
// PRIVATE_CACHE_HEADERS は成功・失敗を問わず全レスポンスに付ける。

export async function GET(request: NextRequest) {
  // 空文字クエリ (`?cursor=` など) は zod の .optional() で弾けないため、事前に undefined 化する
  const cursorRaw = request.nextUrl.searchParams.get('cursor');
  const limitRaw = request.nextUrl.searchParams.get('limit');
  const parsed = listFavoritesQuerySchema.safeParse({
    cursor: cursorRaw && cursorRaw.length > 0 ? cursorRaw : undefined,
    limit: limitRaw && limitRaw.length > 0 ? limitRaw : undefined,
  });
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400, headers: PRIVATE_CACHE_HEADERS });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401, headers: PRIVATE_CACHE_HEADERS },
    );
  }

  try {
    const service = buildFavoriteService(supabase);
    const result = await service.listFavorites({
      userId: user.id,
      cursor: parsed.data.cursor,
      limit: parsed.data.limit,
    });

    return NextResponse.json(result, { status: 200, headers: PRIVATE_CACHE_HEADERS });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: err.message },
        { status: 401, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    if (err instanceof AppError) {
      console.error('[GET /api/favorites] AppError', err);
      return NextResponse.json(
        { error: 'サーバーエラーが発生しました' },
        { status: 500, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    console.error('[GET /api/favorites]', err);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500, headers: PRIVATE_CACHE_HEADERS },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: '認証が必要です' },
      { status: 401, headers: PRIVATE_CACHE_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createFavoriteRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400, headers: PRIVATE_CACHE_HEADERS });
  }

  try {
    // user_id はリクエストボディからではなく必ずセッションから取る (なりすまし防止)
    const service = buildFavoriteService(supabase);
    const favorite = await service.addFavorite(user.id, parsed.data.lgtmImageId);

    return NextResponse.json(
      { id: favorite.id, lgtmImageId: favorite.lgtmImageId },
      { status: 201, headers: PRIVATE_CACHE_HEADERS },
    );
  } catch (err) {
    if (err instanceof DuplicateFavoriteError) {
      return NextResponse.json(
        { error: err.message },
        { status: 409, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json(
        { error: '画像が見つかりません' },
        { status: 404, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: err.message },
        { status: 401, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    if (err instanceof AppError) {
      console.error('[POST /api/favorites] AppError', err);
      return NextResponse.json(
        { error: 'サーバーエラーが発生しました' },
        { status: 500, headers: PRIVATE_CACHE_HEADERS },
      );
    }
    console.error('[POST /api/favorites]', err);
    return NextResponse.json(
      { error: 'サーバーエラーが発生しました' },
      { status: 500, headers: PRIVATE_CACHE_HEADERS },
    );
  }
}
