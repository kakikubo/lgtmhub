import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/src/lib/auth/require-admin';
import { HOME_IMAGES_CACHE_TAG } from '@/src/lib/cache/list-home-images';
import {
  AppError,
  BadRequestError,
  DuplicateImageError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { regenerateImageRequestSchema } from '@/src/lib/validation/image';
import { buildImageService } from '@/src/services/image-service';

// アニメーション GIF → アニメーション WebP の同期合成は最大 150 フレーム ×
// LGTM オーバーレイで数秒〜十数秒かかる。/api/images (POST) と同じ 60 秒に拡張する。
export const maxDuration = 60;

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolved = await params;
  const parsedParams = paramsSchema.safeParse(resolved);
  if (!parsedParams.success) {
    return NextResponse.json({ error: '画像 ID が不正です' }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const { userId } = await requireAdmin(supabase);

    // 空ボディ / 不正 JSON を許容し、いずれも「URL 差し替えなし」として扱う
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsedBody = regenerateImageRequestSchema.safeParse(rawBody ?? {});
    if (!parsedBody.success) {
      const message = parsedBody.error.issues[0]?.message ?? '入力値が不正です';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const service = buildImageService(supabase);
    const { image, previousImageUrl, urlChanged } = await service.regenerateImage(
      parsedParams.data.id,
      parsedBody.data.originalUrl,
      { skipOldBlobDeletion: process.env.VERCEL_ENV === 'preview' },
    );

    revalidateTag(HOME_IMAGES_CACHE_TAG, 'max');

    // 監査ログ: 誰が どの画像を いつ 再生成したか (URL は変更有無だけ記録して PII を最小化)
    console.info('[POST /api/images/[id]/regenerate] regenerated', {
      requesterId: userId,
      imageId: image.id,
      urlChanged,
      previousImageUrl,
      newImageUrl: image.imageUrl,
    });

    return NextResponse.json({ id: image.id, imageUrl: image.imageUrl }, { status: 200 });
  } catch (err) {
    if (err instanceof DuplicateImageError) {
      return NextResponse.json(
        { error: err.message, existingImageId: err.existingImageId },
        { status: 409 },
      );
    }
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 });
    }
    if (err instanceof BadRequestError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: '再生成する権限がありません' }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[POST /api/images/[id]/regenerate] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[POST /api/images/[id]/regenerate]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
