import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';
import { AppError, ForbiddenError, NotFoundError, UnauthorizedError } from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const parsed = paramsSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: '画像 ID が不正です' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const service = buildImageService(supabase);
    await service.deleteImage(parsed.data.id, user.id);
    revalidateTag(HOME_IMAGES_CACHE_TAG);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: '削除する権限がありません' }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[DELETE /api/images/[id]] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[DELETE /api/images/[id]]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
