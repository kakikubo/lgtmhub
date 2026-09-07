import { type NextRequest, NextResponse } from 'next/server';
import { AppError, NotFoundError, UnauthorizedError } from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { favoriteImageIdParamSchema } from '@/src/lib/validation/favorite';
import { buildFavoriteService } from '@/src/services/favorite-service';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ lgtmImageId: string }> },
) {
  const resolved = await params;
  const parsed = favoriteImageIdParamSchema.safeParse(resolved);
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
    const service = buildFavoriteService(supabase);
    await service.removeFavorite(user.id, parsed.data.lgtmImageId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      // 「すでに解除済み」も含めて 404。UI は望む状態 (未登録) と一致するためエラー扱いしない
      // (functional-design.md のお気に入り解除の冪等性)。
      return NextResponse.json({ error: 'お気に入りが見つかりません' }, { status: 404 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[DELETE /api/favorites/[lgtmImageId]] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[DELETE /api/favorites/[lgtmImageId]]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
