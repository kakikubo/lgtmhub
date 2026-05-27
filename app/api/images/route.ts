import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';
import {
  AppError,
  BadRequestError,
  DailyLimitExceededError,
  DuplicateImageError,
  UnauthorizedError,
} from '@/src/lib/errors';
import { createAnonClient } from '@/src/lib/supabase/anon';
import { createClient } from '@/src/lib/supabase/server';
import { createImageRequestSchema, listImagesQuerySchema } from '@/src/lib/validation/image';
import { buildImageService } from '@/src/services/image-service';

export async function GET(request: NextRequest) {
  // 空文字クエリ (`?cursor=` など) は zod の .optional() で弾けないため、事前に undefined 化する
  const cursorRaw = request.nextUrl.searchParams.get('cursor');
  const limitRaw = request.nextUrl.searchParams.get('limit');
  const params = {
    cursor: cursorRaw && cursorRaw.length > 0 ? cursorRaw : undefined,
    limit: limitRaw && limitRaw.length > 0 ? limitRaw : undefined,
  };

  const parsed = listImagesQuerySchema.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    // Cookie 連携の createClient() を使うと Set-Cookie がレスポンスに乗り Vercel CDN が
    // キャッシュを諦めるため、anon ロールで読み取り RLS の "anyone can view active images" を通す。
    // architecture.md の Cache-Control 方針 (Issue #46 案 #3) を実効化するための前提条件。
    const supabase = createAnonClient();
    const service = buildImageService(supabase);
    const result = await service.listImages(parsed.data);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[GET /api/images]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createImageRequestSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const service = buildImageService(supabase);
    const image = await service.createImage(user.id, parsed.data.imageUrl);
    revalidateTag(HOME_IMAGES_CACHE_TAG);
    return NextResponse.json({ id: image.id, imageUrl: image.imageUrl }, { status: 201 });
  } catch (err) {
    if (err instanceof DuplicateImageError) {
      return NextResponse.json(
        { error: err.message, existingImageId: err.existingImageId },
        { status: 409 },
      );
    }
    if (err instanceof DailyLimitExceededError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
    if (err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[POST /api/images] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[POST /api/images]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
