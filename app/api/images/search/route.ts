import { type NextRequest, NextResponse } from 'next/server';
import { AppError, ExternalServiceError, RateLimitedError } from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { imageSearchQuerySchema } from '@/src/lib/validation/image-search';
import {
  buildImageSearchProvider,
  type ImageSearchProvider,
} from '@/src/services/image-search-service';

export interface SearchRouteDeps {
  provider?: ImageSearchProvider;
}

export async function GET(request: NextRequest) {
  return handleSearch(request, {});
}

export async function handleSearch(request: NextRequest, deps: SearchRouteDeps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const qRaw = request.nextUrl.searchParams.get('q');
  const pageRaw = request.nextUrl.searchParams.get('page');
  const params = {
    q: qRaw ?? '',
    page: pageRaw && pageRaw.length > 0 ? pageRaw : undefined,
  };

  const parsed = imageSearchQuerySchema.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? '入力値が不正です';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  let provider: ImageSearchProvider;
  try {
    provider = deps.provider ?? buildImageSearchProvider();
  } catch (err) {
    console.error('[GET /api/images/search] provider init', err);
    return NextResponse.json(
      { error: '画像検索を利用できません。管理者に連絡してください' },
      { status: 503 },
    );
  }

  try {
    const result = await provider.search({ query: parsed.data.q, page: parsed.data.page });
    return NextResponse.json(result, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    if (err instanceof ExternalServiceError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    if (err instanceof AppError) {
      console.error('[GET /api/images/search] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[GET /api/images/search]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
