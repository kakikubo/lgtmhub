import { NextResponse, type NextRequest } from 'next/server';
import {
  AppError,
  BadRequestError,
  DailyLimitExceededError,
  DuplicateImageError,
  UnauthorizedError,
} from '@/src/lib/errors';
import { createImageRequestSchema } from '@/src/lib/validation/image';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';

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
