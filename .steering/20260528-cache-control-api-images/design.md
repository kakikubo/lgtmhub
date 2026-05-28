# 設計: `/api/images` GET の CDN キャッシュ対応

## 方針

`/api/images` GET を Vercel CDN にキャッシュさせるため、以下 3 点を **同一 PR で同時に** 適用する。

| # | 変更 | 目的 |
|---|------|------|
| A | GET ハンドラの Supabase クライアントを `createAnonClient` に切替 | レスポンスに `Set-Cookie` が乗らないようにし CDN キャッシュ対象化 |
| B | `middleware.ts` で GET `/api/images` をショートサーキット | middleware による `Set-Cookie` も封じる + 1 RTT 削減 |
| C | GET レスポンスに `Cache-Control: s-maxage=60, stale-while-revalidate=300` を付与 | CDN にキャッシュ指示を出す |

A・B 単体では CDN は効かず、3 つ揃って初めて Vercel CDN の `HIT` が発生する。1 関心事 (CDN キャッシュ実効化) の連帯変更として 1 PR にまとめる。

## 変更内容

### A. `app/api/images/route.ts` GET ハンドラ

#### Before

```typescript
import { createClient } from '@/src/lib/supabase/server';

export async function GET(request: NextRequest) {
  // ...
  const supabase = await createClient();  // ← Cookie 連携サーバクライアント
  const service = buildImageService(supabase);
  const result = await service.listImages(parsed.data);
  return NextResponse.json(result, { status: 200 });
}
```

#### After

```typescript
import { createAnonClient } from '@/src/lib/supabase/anon';

export async function GET(request: NextRequest) {
  // ...
  const supabase = createAnonClient();  // ← Cookie 非依存 anon ロール
  const service = buildImageService(supabase);
  const result = await service.listImages(parsed.data);
  return NextResponse.json(result, {
    status: 200,
    headers: {
      'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

#### 設計判断

- **anon ロール採用**: 既に `src/lib/cache/list-home-images.ts:18` (`unstable_cache` 配下) で同じ理由 (`cookies()` を呼べない) から `createAnonClient` を使っており、本ルートも同じ「公開データ取得」用途として整合する
- **POST はそのまま**: POST は `auth.getUser()` で認証必須、`createClient()` を維持

### B. `middleware.ts` のショートサーキット

#### Before

```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(/* ... */);
  await supabase.auth.getUser();  // matcher 該当の全 method で実行
  return response;
}

export const config = {
  matcher: ['/images/new', '/api/images/:path*'],
};
```

#### After

```typescript
export async function middleware(request: NextRequest) {
  // /api/images GET は CDN キャッシュ対象 (Issue #46 案 #3)。
  // session refresh で Set-Cookie が乗ると Vercel CDN がキャッシュを諦めるため、
  // matcher 内であっても method/path 条件で early-return する。
  // Next.js の config.matcher は HTTP method 分岐をサポートしないため middleware 本体で判定する。
  if (request.method === 'GET' && request.nextUrl.pathname === '/api/images') {
    return NextResponse.next({ request });
  }

  const response = NextResponse.next({ request });
  const supabase = createServerClient(/* ... */);
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/images/new', '/api/images/:path*'],  // 変更なし
};
```

#### 設計判断

- **matcher は変更しない**:
  - POST `/api/images` と DELETE `/api/images/[id]` は引き続き middleware を通す必要があるため、`'/api/images/:path*'` を残す
  - matcher を分割せず、本体で method 分岐する方が変更が局所化され可読性も高い
- **`pathname === '/api/images'` の完全一致**:
  - `/api/images/[id]` (将来 GET が追加される可能性) や `/api/images/random` を巻き込まないように完全一致で判定
  - `/api/images/random` GET も将来的に short-circuit したい場面はあるが、本 PR スコープ外 (no-store 設定済み)
- **`return NextResponse.next({ request })`**:
  - middleware 本体と同じ「素通し」レスポンスを返す。`Set-Cookie` を一切付けないことで CDN がキャッシュ可能になる

### C. GET レスポンスの Cache-Control

architecture.md:245 と完全一致する文字列を採用する。

```text
Cache-Control: s-maxage=60, stale-while-revalidate=300
```

#### 設計判断

- **`public` ディレクティブは付けない**:
  - architecture.md の方針に `public` が含まれていないため、文言を一致させる
  - Vercel CDN は `s-maxage` 単独でもキャッシュ対象として扱うため、`public` 無しでも CDN は効く
  - ブラウザ私的キャッシュ (max-age) はあえて付けない。CDN レイヤだけでヒット率を稼ぐ
- **`stale-while-revalidate=300`**:
  - 60 秒の `s-maxage` 期限後 5 分間は古い値を返しつつバックグラウンドで再検証
  - 投稿/削除後 60 秒以内に LoadMore で古い一覧を見る可能性があるが、cursor 無しトップ一覧は SSR の `unstable_cache` が `revalidateTag` で即時破棄されるため致命傷ではない
- **エラー時 (400 / 500) は Cache-Control を付けない**:
  - エラーレスポンスをキャッシュさせる意味はない。`NextResponse.json(error, { status })` のままにする

### D. ユニットテスト追加

`tests/unit/api/images/list-route.test.ts` に以下を追加:

```typescript
it('成功時は Cache-Control: s-maxage=60, stale-while-revalidate=300 を返す', async () => {
  createClient.mockResolvedValue({});
  buildImageService.mockReturnValue({
    listImages: vi.fn().mockResolvedValue({ images: [IMAGE], nextCursor: null }),
  });

  const res = await callGet();

  expect(res.headers.get('Cache-Control')).toBe('s-maxage=60, stale-while-revalidate=300');
});
```

既存テストは `vi.mock('@/src/lib/supabase/server')` で `createClient` をモックしているが、本 PR では GET 側が `createAnonClient` を使うため、追加で `vi.mock('@/src/lib/supabase/anon')` も用意する必要がある。

#### モック修正方針

```typescript
const createAnonClient = vi.fn();

vi.mock('@/src/lib/supabase/anon', () => ({
  createAnonClient: () => createAnonClient(),
}));

beforeEach(() => {
  createAnonClient.mockReset();
  // ...
});
```

既存 GET テストの `createClient.mockResolvedValue({});` も `createAnonClient.mockReturnValue({});` (同期関数なので Resolved ではなく Return) に置き換える。

POST テスト側は `createClient` のままで動作する。

## 影響範囲

- `app/api/images/route.ts` (GET ハンドラのみ)
- `middleware.ts` (本体 1 行追加)
- `tests/unit/api/images/list-route.test.ts` (モック追加 + assertion 1 件追加)

それ以外には触らない。`docs/architecture.md` は既に整合しているため変更不要。

## 動作確認手順 (実装中: ローカル dev)

1. `npm run dev` で起動
2. ブラウザの DevTools Network で `GET /api/images` を観察
   - レスポンスヘッダに `Cache-Control: s-maxage=60, stale-while-revalidate=300` が含まれる
   - `Set-Cookie` がレスポンスに乗っていない
3. `POST /api/images` を実行し、middleware を通って 200 / 201 系で返ることを確認 (session refresh 経路の温存)

## 動作確認手順 (デプロイ後: Vercel preview)

1. `gh pr create` 後、Vercel preview URL を取得
2. `curl -I "${PREVIEW_URL}/api/images"` を 2 回実行
   - 1 回目: `x-vercel-cache: MISS`
   - 2 回目 (60 秒以内): `x-vercel-cache: HIT`
3. Supabase Studio → Logs → API logs
   - 同条件アクセス 2 回目に `lgtm_images` への SELECT が発生していないことを確認
4. Chrome DevTools MCP で `/` の TTFB / LCP を計測 (Before/After は後段の retrospective で記録)

## docs 更新

- `docs/architecture.md`: 文言と実装が一致するため変更不要
- 必要ならコメントで `(Issue #46)` を `/api/images/route.ts` GET に明記する (実装時判断)

## ロールバック方針

- 想定外の不具合発生時は revert で 1 commit を戻すだけで完全復旧 (Cookie 連携 / Cache-Control 無しの状態に戻る)
- `revalidateTag` の挙動は変更していないため、SSR 側のキャッシュは影響を受けない
