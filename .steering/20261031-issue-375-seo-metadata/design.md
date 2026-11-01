# OGP・metadataBase・sitemap・robots と詳細ページの generateMetadata (#375)

## 結論
ルート layout に `metadataBase`・`title.template`・既定 `openGraph`/`twitter` を置き、詳細ページの `generateMetadata` で画像の Blob URL と width/height を `og:image` に出す。
`sitemap.ts` は既存の一覧キャッシュタグ (`lgtm-images:list`) を共有するキャッシュ関数で全 active 画像を出し、投稿・削除時の既存 `revalidateTag` でそのまま無効化させる。
ベース URL は Vercel のシステム環境変数から解決し、新しい env の追加・設定作業を不要にする。

## 設計

### ベース URL (`src/lib/site-url.ts`)
`getSiteUrl(): URL` を次の順で解決する。

| 条件 | 値 |
|---|---|
| `VERCEL_ENV === 'production'` | `https://${VERCEL_PROJECT_PRODUCTION_URL}` |
| `VERCEL_URL` あり (Preview) | `https://${VERCEL_URL}` |
| それ以外 (ローカル / CI) | `http://localhost:3000` |

### ルート metadata (`app/layout.tsx`)
- `metadataBase: getSiteUrl()`
- `title: { default: 'LGTMHub', template: '%s | LGTMHub' }`
- `openGraph: { siteName, type: 'website', locale: 'ja_JP' }` / `twitter: { card: 'summary_large_image' }`

### ページごとの title
| ページ | title |
|---|---|
| `/images/[id]` | `LGTM 画像 (<id 先頭 8 桁>)` ※画像にタイトル列が無いため id で一意化 |
| `/images/new` | `画像をアップロード` |
| `/favorites` | `お気に入り` |

### 詳細ページ `generateMetadata`
- `getImageDetail(id)` を `createAnonClient()` で呼ぶ（RLS で anon も active を読める）。見つからなければ `{}` を返し、既存の `notFound()` → noindex の流れに任せる
- `openGraph.images` / `twitter.images` に `{ url: imageUrl, width, height, alt: 'LGTM' }`、`alternates.canonical: /images/<id>`
- ページ本体の取得処理は変更しない（クエリが 1 本増えるが PK 検索のみ）

### `app/sitemap.ts`
- `src/services/cache/list-sitemap-image-ids.ts` に `'use cache'` + `cacheTag(HOME_IMAGES_CACHE_TAG)` + `cacheLife('max')` の関数を置き、`ImageService.listActiveImageIds()`（Repository の `listActiveIds()` を委譲）の結果を返す
- 出力: `/`（トップ）+ `/images/<id>` 全件。`lastModified` は付けない（`listActiveIds` は id のみを返し、列追加のためだけにクエリを変えない）

### `app/robots.ts`
- production: `allow: /`、`disallow: /api/, /images/new, /favorites`、`sitemap: <base>/sitemap.xml`
- production 以外: `disallow: /`（Preview がインデックスされないようにする）

## 検討した代替案
| 案 | 却下理由 |
|---|---|
| `NEXT_PUBLIC_SITE_URL` を新設 | Vercel の全環境で設定が要る。Preview 用の値も必要で、過去に auth の `redirectTo` を固定して Preview が壊れた経緯がある（`.steering/20260506-vercel-preview-auth-redirect`） |
| sitemap を毎リクエスト動的生成 (`connection()`) | クロールのたびに全件クエリが走る。既存タグで無効化できるのでキャッシュの方が安い |
| 詳細 metadata 用に画像ごとの `'use cache'` + `cacheTag` | 削除時に画像ごとのタグ無効化が新たに必要になる。PK 検索 1 本のためキャッシュの利点が小さい |
| `opengraph-image.tsx` でサイト既定画像を生成 | 画像デザインが未定。詳細ページは実画像を使うため、今回の目的（共有時のプレビュー）には不要 |

## Non-goals
- サイト既定の OG 画像（トップの共有プレビュー画像）
- OG 画像の PNG 変換（WebP のまま出す。X / Slack / Facebook は WebP の og:image を表示する）
- `generateSitemaps` による 5 万件超の分割
- 構造化データ (JSON-LD)
