# 設計: 画像登録ページのキーワード検索（Issue #78）

## 全体方針

- **既存パイプラインを再利用**: 検索結果から選択した画像 URL を既存 `POST /api/images` に流すことで、SSRF 検証 / フォーマット検証 / 重複検知 / LGTM 合成 / Vercel Blob 保存 / カウント更新の全ロジックをそのまま通す。
- **API レイヤー薄型**: `/api/images/search` は外部 API を叩いて正規化するだけの薄い Route Handler とし、ビジネスロジックは Service 層に閉じ込める。
- **Provider 抽象化**: Pexels に固定するが、将来の差し替えを想定してインターフェイスで疎結合にする。

## 採用プロバイダー: Pexels

- エンドポイント: `https://api.pexels.com/v1/search`
- 認証: `Authorization: <API_KEY>` ヘッダー
- レート: 200 req/hour, 20,000 req/month（無料枠）
- ライセンス: Pexels License（商用 OK、個別の attribution は推奨だが必須ではない。"Photos provided by Pexels" のサイト表示は必須）

### Pexels リクエスト/レスポンスの抜粋

リクエスト: `GET https://api.pexels.com/v1/search?query={q}&per_page=15&page={page}`

レスポンス（必要な項目のみ）:

```json
{
  "page": 1,
  "per_page": 15,
  "photos": [
    {
      "id": 2014422,
      "width": 3024,
      "height": 3024,
      "url": "https://www.pexels.com/photo/...",
      "photographer": "Joey Farina",
      "photographer_url": "https://www.pexels.com/@joey",
      "src": {
        "medium": "https://images.pexels.com/photos/.../medium.jpg",
        "large": "https://images.pexels.com/photos/.../large.jpg",
        "original": "https://images.pexels.com/photos/.../original.jpg"
      },
      "alt": "..."
    }
  ],
  "next_page": "https://api.pexels.com/v1/search/?page=2&...",
  "total_results": 1234
}
```

## サーバーサイド設計

### ファイル構成（追加）

```
app/api/images/search/route.ts          # Route Handler (GET)
src/lib/validation/image-search.ts       # zod スキーマ (リクエスト・レスポンス)
src/services/image-search-service.ts     # ImageSearchService + Provider IF + Pexels アダプタ
```

### `src/lib/validation/image-search.ts`

```typescript
export const imageSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'キーワードを入力してください').max(100, 'キーワードが長すぎます'),
  page: z.coerce.number().int().min(1).max(50).optional(),
});

export const imageSearchResultSchema = z.object({
  id: z.string(),               // provider 内 ID（"pexels:2014422" など）
  thumbnailUrl: z.string().url(),
  imageUrl: z.string().url(),   // 登録時に POST /api/images へ渡す URL
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  alt: z.string(),
  provider: z.literal('pexels'),
  attribution: z.object({
    photographer: z.string(),
    photographerUrl: z.string().url(),
    sourceUrl: z.string().url(), // pexels.com の写真詳細 URL
  }),
});

export const imageSearchResponseSchema = z.object({
  results: z.array(imageSearchResultSchema),
  page: z.number().int().min(1),
  hasNextPage: z.boolean(),
  provider: z.literal('pexels'),
});
```

### `src/services/image-search-service.ts`

```typescript
export interface ImageSearchParams {
  query: string;
  page?: number;
}

export interface ImageSearchResultPage {
  results: ImageSearchResult[];
  page: number;
  hasNextPage: boolean;
  provider: 'pexels';
}

export interface ImageSearchProvider {
  search(params: ImageSearchParams): Promise<ImageSearchResultPage>;
}

export class PexelsImageSearchProvider implements ImageSearchProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}
  // 1ページ 15 枚、AbortSignal.timeout(8000) でタイムアウト
  async search(params: ImageSearchParams): Promise<ImageSearchResultPage> { ... }
}

export function buildImageSearchProvider(): ImageSearchProvider {
  const provider = process.env.IMAGE_SEARCH_PROVIDER ?? 'pexels';
  const apiKey = process.env.IMAGE_SEARCH_API_KEY;
  if (!apiKey) throw new Error('IMAGE_SEARCH_API_KEY is required');
  if (provider !== 'pexels') throw new Error(`unsupported provider: ${provider}`);
  return new PexelsImageSearchProvider(apiKey);
}
```

エラーマッピング:

| Pexels HTTP | アプリ層 | 上位の HTTP |
|---|---|---|
| 200 | OK | 200 |
| 401/403 (キー無効) | `AppError` (内部設定エラー) | 500 |
| 429 (レート上限) | `RateLimitedError` | 503 |
| その他 5xx | `AppError` | 502 |
| ネットワーク失敗 / タイムアウト | `AppError` | 502 |

新規例外 `RateLimitedError` を `src/lib/errors.ts` に追加。

### `app/api/images/search/route.ts`

```typescript
export async function GET(request: NextRequest) {
  // 1. 認証チェック (POST /api/images と同等)。未ログインなら 401
  // 2. クエリ検証 (zod)。失敗で 400
  // 3. provider.search() を呼ぶ
  //    - 成功: 200 + JSON。Cache-Control: s-maxage=60, stale-while-revalidate=300
  //    - RateLimitedError: 503 (UI が「混雑しています」表示)
  //    - その他 AppError: 502 ("検索に失敗しました")
}
```

## フロントエンド設計

### コンポーネント構成

```
components/
├── image-register-form.tsx          # 既存（無変更で維持）
├── image-register-tabs.tsx          # 新設: タブ切り替え制御
└── image-search-picker.tsx          # 新設: 検索 UI + 画像選択 + 登録呼び出し
```

`/images/new` の Server Component (`app/(site)/images/new/page.tsx`) は `<ImageRegisterTabs />` をマウントするのみとする。

### `ImageRegisterTabs`

- `useState<'url' | 'search'>('url')` でアクティブタブを保持。
- 2 タブ構成。`role="tablist"`/`role="tab"`/`role="tabpanel"` のアクセシビリティ属性を付与。
- URL 入力タブ → `<ImageRegisterForm />` をそのまま描画。
- 検索タブ → `<ImageSearchPicker />` を描画。
- 既存 e2e テストを壊さないため、URL 入力タブを **デフォルトのアクティブタブ** にする。

### `ImageSearchPicker`

ステート:

```typescript
type Status = 'idle' | 'searching' | 'submitting';

const [keyword, setKeyword] = useState('');
const [status, setStatus] = useState<Status>('idle');
const [results, setResults] = useState<ImageSearchResult[]>([]);
const [page, setPage] = useState<number>(1);
const [hasNextPage, setHasNextPage] = useState<boolean>(false);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [errorMessage, setErrorMessage] = useState<string | null>(null);
```

イベント:

1. **検索送信** (`onSubmit`)
   - `setStatus('searching')` → `fetch('/api/images/search?q=...&page=1')`
   - 成功で `results` / `page=1` / `hasNextPage` を更新
   - 失敗で `errorMessage` を設定

2. **「もっと見る」** (`onClick`)
   - 次ページを取得して `results` に append

3. **画像クリック**
   - 候補のサムネを選択状態にして `selectedId` を更新

4. **「この画像で登録する」**
   - `setStatus('submitting')` → `POST /api/images` (既存と同じ payload `{ imageUrl }`)
   - 成功時 → 既存 `ImageRegisterForm` と同じく `router.refresh()` → `router.push('/')`
   - 失敗時 → `mapCreateImageError` で UI メッセージ表示

UI:

- キーワード入力: `<input type="search" />` + 検索ボタン（`disabled={status !== 'idle' && status !== 'submitting'}`）
- グリッド: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2` でサムネイル表示。選択時はリングを付与。
- 「もっと見る」ボタン: `hasNextPage` のときのみ。
- 「この画像で登録する」ボタン: `selectedId` が決まったら活性。
- フッター: 「Photos provided by [Pexels](https://www.pexels.com)」 + 選択中画像の `photographer` クレジット。
- エラー表示は `role="alert"` で行う。

### バリデーション

- フロント側でも `imageSearchQuerySchema` で空文字を弾く。
- レスポンス受領時は `imageSearchResponseSchema.safeParse` で握りつぶさない（`ImageRegisterForm` の既存パターンに合わせる）。

## エラーハンドリング方針

| 失敗種別 | UI 表示 |
|---|---|
| クエリ空 | 「キーワードを入力してください」 |
| 0 件ヒット | 「該当する画像が見つかりませんでした。別のキーワードをお試しください」 |
| 401 (セッション切れ) | 「セッションが切れました。再度ログインしてください」+ トップへ戻るリンク |
| 503 (レート上限) | 「検索が混雑しています。少し待ってからお試しください」 |
| 502 / その他 | 「画像検索に失敗しました。時間をおいて再度お試しください」 |

## ドキュメント差分

- `product-requirements.md`: 機能 1 の受け入れ条件に「キーワード検索からも登録できる」を追加 + サブ機能として 1-B を新設
- `functional-design.md`: API 設計に「画像検索」を追加、UI 設計の画像登録画面にタブを追記
- `architecture.md`: 外部依存に「Pexels API」を追記、環境変数一覧を更新
- `.env.example` / `README.md`: 取得手順を追記

## キャッシュ戦略

- `/api/images/search` のレスポンスに `Cache-Control: s-maxage=60, stale-while-revalidate=300` を付与（既存 `/api/images` の方針と整合）。
- ユーザー個別性が無いキーワード検索結果を Vercel Edge でキャッシュし、Pexels の rate limit を緩和する。

## ロールアウト方針

- 既存 `/images/new` の URL 入力タブをデフォルトとし、検索タブはオプションとして提示するため、既存 e2e は壊れない。
- `IMAGE_SEARCH_API_KEY` 未設定環境では検索タブで 502 が返るが、URL 入力タブは引き続き動作する（=既存機能の後退なし）。
