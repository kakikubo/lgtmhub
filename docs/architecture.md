# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン | 選定理由 |
|------|-----------|----------|
| Node.js | v24.11.0 | CLAUDE.mdで指定。Next.js 16のサポート対象、非同期I/Oに優れSharpの画像処理を高速に実行可能 |
| TypeScript | 6.x | CLAUDE.mdで指定。静的型付けでバグを早期検出、Supabase / Next.jsの型生成が充実 |
| pnpm | 10.x | CLAUDE.mdで指定。Corepack 経由で利用し、`package.json` の `packageManager` でバージョンを固定 |

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Next.js | 16.x | フルスタックフレームワーク | App Router採用でSSR・APIルート・画像最適化を統合的に提供。Vercelとの親和性が最高 |
| React | 19.x | UIライブラリ | Next.js 16が要求。Server Components対応 |
| Tailwind CSS | 4.x | スタイリング | ユーティリティクラスで高速にUI構築、デザイントークンの一元管理が容易 |
| Sharp | 0.34.x | 画像処理 | LGTM文字合成・WebP変換・リサイズ・pHash計算をNode.js上で高速処理 |
| @supabase/supabase-js | 2.x | DB・認証クライアント | Supabase公式SDK、TypeScript型生成と統合 |
| @supabase/ssr | 0.5.x | Next.js SSR用ヘルパー | Server Components / Route Handlerでセッション管理 |
| @vercel/blob | 0.27.x | CDNストレージクライアント | Vercel Blob公式SDK、サーバーサイドからのアップロード対応 |
| zod | 3.x | スキーマバリデーション | APIリクエストの型安全な検証、Supabaseと組み合わせて入力検証 |

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Biome | 2.x | リンター + フォーマッター | Rust 実装で高速、設定一元化(`biome.json` 1 ファイル)、ESLint + Prettier の責務を統合 |
| lefthook | 2.x | Git hooks マネージャー | `pnpm install` 時の `prepare` スクリプトで自動配置、`pre-commit` で staged ファイルに Biome を自動実行(`lefthook.yml` で設定) |
| Vitest | 3.x | ユニットテストフレームワーク | Viteベースで高速、Jestと互換APIで学習コスト低 |
| Playwright | 1.5x | E2Eテスト | モダンなブラウザ自動化、Vercelプレビュー環境でも動作 |
| supabase CLI | 2.x | ローカルDB・マイグレーション管理 | ローカルでSupabaseスタックをDocker起動、マイグレーションをコード管理 |

---

## アーキテクチャパターン

### レイヤードアーキテクチャ（Next.js App Router）

```
┌──────────────────────────────────────────────┐
│  Presentation Layer                          │
│  (Server Components / Client Components)     │ ← UI、ユーザー入力
├──────────────────────────────────────────────┤
│  API Layer                                   │
│  (Route Handlers: app/api/**)                │ ← HTTP境界、認証、入力検証
├──────────────────────────────────────────────┤
│  Service Layer                               │
│  (src/services/**)                           │ ← ビジネスロジック
├──────────────────────────────────────────────┤
│  Data Layer                                  │
│  (src/repositories/**, Supabase Client)      │ ← DB / Blob / 外部HTTP
└──────────────────────────────────────────────┘
```

#### Presentation Layer
- **責務**: 画面描画、ユーザー入力の受付、API呼び出し、表示用データ整形
- **許可される操作**: API Layer の呼び出し（`fetch`）、Server Components から直接 Service Layer の呼び出し
- **禁止される操作**: Data Layer（Repository / Supabase Client）への直接アクセス

#### API Layer
- **責務**: HTTPリクエスト受付、認証チェック、入力スキーマ検証（zod）、エラー変換、レスポンス整形
- **許可される操作**: Service Layer の呼び出し
- **禁止される操作**: ビジネスロジックの実装、Repository への直接アクセス

#### Service Layer
- **責務**: ビジネスロジック（重複判定・上限チェック・LGTM合成オーケストレーション・権限制御）
- **許可される操作**: Repository / 外部サービスクライアント（Sharp / Vercel Blob）の呼び出し
- **禁止される操作**: HTTPレスポンスの組み立て、UIへの依存

#### Data Layer
- **責務**: データの永続化と取得（Supabase / Vercel Blob / 外部URLからの画像取得）
- **許可される操作**: Supabase Client / Vercel Blob SDK / `fetch` の呼び出し
- **禁止される操作**: ビジネスロジックの実装

### 依存関係の方向

```
Presentation → API → Service → Data
            ↘ Service（Server Component直接呼び出しのみOK）
```

逆方向の依存は禁止。Server Components から Service Layer を直接呼び出すケースのみ、API Layer をスキップしてよい。

---

## デプロイ・実行環境

### 環境構成

| 環境 | 用途 | URL | DB / Blob |
|------|------|-----|-----------|
| local | 開発 | `http://localhost:3000` | Supabase Local（Docker）/ Vercel Blob（dev token） |
| preview | PR毎のプレビュー | `https://lgtmhub-pr-{n}.vercel.app` | Supabase（preview project）/ Vercel Blob（preview store） |
| production | 本番 | `https://lgtmhub.vercel.app`（仮） | Supabase（prod project）/ Vercel Blob（prod store） |

### CI/CD

- **GitHub → Vercel自動連携**: `main` ブランチへのpushで本番デプロイ、PR作成でプレビューデプロイ
- **マイグレーション**: `supabase db push` をGitHub Actionsで `main` マージ時に実行

> CI/CD の詳細設定（GitHub Actions の jobs / steps、package.json scripts、テスト戦略）は [`docs/development-guidelines.md`](./development-guidelines.md)「CI/CDパイプライン」を正典とする。本セクションはデプロイフローの概要のみを扱う。

### 実行リージョン

- **Vercel 関数リージョン**: `vercel.json` の `regions` で `hnd1`（東京）に固定する。Vercel のデフォルトは `iad1`（US 東海岸）のため、明示しないと全 Route Handler / SSR が US 東海岸で実行され、日本のユーザー・Supabase（`ap-northeast-1` 想定）との RTT が無駄に伸びる。`regions` は全 Vercel 関数のデフォルトリージョンを設定する（単一リージョン指定は全プランで利用可）。
- **Edge Middleware**: `regions` の対象外。常にユーザー近傍の Edge で実行される。
- **確認方法**: レスポンスヘッダ `x-vercel-id`（`<edge>::<function>::<reqid>`）の Function 部が `hnd1` であることで実行リージョンを判定できる。
- **Supabase リージョン**: `ap-northeast-1`（東京）で揃えることを前提とする。関数を東京にしても DB が遠隔だと往復が遠回りになるため、両者を東京で揃える。

---

## データ永続化戦略

### ストレージ方式

| データ種別 | ストレージ | フォーマット | 理由 |
|-----------|----------|-------------|------|
| ユーザープロフィール | Supabase（PostgreSQL） | リレーショナル | 認証情報と1:1で結合、RLSで保護 |
| LGTM画像メタデータ | Supabase（PostgreSQL） | リレーショナル | お気に入りとのJOIN、pHashインデックス検索 |
| お気に入り | Supabase（PostgreSQL） | リレーショナル | (user_id, lgtm_image_id)のUNIQUE制約 |
| 1日の登録カウント | Supabase（PostgreSQL） | リレーショナル | 原子的なINCREMENT、UPSERT |
| LGTM合成済み画像本体 | Vercel Blob | WebP（バイナリ） | CDN配信が標準、HTTPSアクセス可能、Next.js Image最適化と相性良 |

### バックアップ戦略

- **Supabase**: 無料プランでは7日間のpoint-in-time recovery、有料プランで30日まで延長
  - **頻度**: Supabase標準の自動バックアップ（日次）
  - **復元方法**: Supabaseダッシュボードからスナップショット指定で復元
- **Vercel Blob**: 標準ではバックアップ機能なし
  - **対策**: 削除は論理削除（`status = 'deleted'`）とし、Blob上のファイルは30日間保持してから物理削除
  - **物理削除**: GitHub Actions で日次クリーンアップジョブを実行（MVP後に検討）

### マイグレーション管理

- `supabase/migrations/` 配下にSQLファイルとして配置
- 命名規則: `YYYYMMDDHHMMSS_description.sql`
- ローカルでは `supabase db reset` でクリーンに適用可能

---

## パフォーマンス要件

### レスポンスタイム

| 操作 | 目標時間 | 測定指標 | 測定環境 | 測定方法 |
|------|---------|----------|---------|----------|
| 画像一覧の初期表示（16件） | 3秒以内 | **LCP（Largest Contentful Paint）** | Vercel Edge Network、3G相当回線 | Lighthouse / Vercel Analytics |
| マークダウンリンクのコピー | 100ms以内 | 操作完了時間 | クライアント側 | クリック→クリップボード書き込み完了までの計測 |
| 画像登録処理（ダウンロード〜CDN保存） | 10秒以内 | サーバー処理時間 | Vercel Function（リージョン: hnd1） | サーバーログでstart/end計測 |
| API応答（一覧取得） | 500ms以内（p95） | TTFB相当 | Vercel Function | Vercel Analytics |
| 画像詳細ページの初期表示 | 2秒以内 | **LCP** | Vercel Edge Network、3G相当回線 | Lighthouse |

> パフォーマンス指標は PRD「非機能要件 > パフォーマンス」と同期。変更時は PRD と本ドキュメントの両方を更新する。

### リソース使用量

| リソース | 上限 | 理由 |
|---------|------|------|
| Vercel Functionメモリ | 1024MB | Sharp処理のピーク時を考慮、無料プランの上限内 |
| Vercel Functionタイムアウト | 10秒 | 無料プランの上限。画像登録処理はこの範囲内に収める |
| Supabase DB接続 | プール経由 | 同時接続数を抑え、無料枠内で運用 |
| 1画像あたりのBlob容量 | 1MB以内（合成後WebP） | Vercel Blob無料枠（合計1GB）で1000枚相当を確保 |

---

## セキュリティアーキテクチャ

### データ保護

- **転送時暗号化**: 全通信HTTPS（VercelおよびSupabaseが自動でTLS終端）
- **保存時暗号化**: Supabase / Vercel Blob ともにストレージレベルで暗号化（AES-256）
- **レスポンスヘッダ**: `vercel.json` の `headers` で `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` を全パスに適用。`Strict-Transport-Security` は Vercel が自動付与するため二重指定しない。CSP は Next.js の動的 nonce が必要なため proxy ベースで別途検討（未着手）
- **アクセス制御**:
  - Supabase Row Level Security（RLS）を全テーブルで有効化
  - クライアントから直接Supabaseに接続せず、Next.js Route Handler を経由
- **機密情報管理**:
  - Vercel環境変数で管理（コミット禁止）
  - 主な環境変数:
    - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（公開用）
    - `SUPABASE_SERVICE_ROLE_KEY`（サーバーサイド専用、絶対にクライアント露出禁止）
    - `BLOB_READ_WRITE_TOKEN`（Vercel Blob書き込み用）
    - `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`（Supabase Auth経由で利用）

### 入力検証

- **バリデーション**: 全API Routeで `zod` スキーマで検証
  - 画像URL: HTTPSのみ許可、最大2048文字
  - UUID: 正規表現 + zodの `uuid()` で検証
- **サニタイゼーション**:
  - 表示名・ファイル名はHTMLエスケープしてレンダリング（Reactのデフォルトで自動）
  - SQLインジェクションはSupabase Client（パラメータ化クエリ）で対策

### SSRF対策（外部URLからの画像取得）

```typescript
// プライベートIPレンジへのアクセスを禁止
const PRIVATE_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,        // link-local
  /^::1$/, /^fc00:/, /^fe80:/, // IPv6
];

async function safeImageFetch(url: string): Promise<Response> {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') {
    throw new BadRequestError('HTTPS URLのみ許可されています');
  }
  // DNS解決後にIPをチェック
  const ips = await dns.resolve(parsed.hostname);
  if (ips.some(ip => PRIVATE_IP_RANGES.some(re => re.test(ip)))) {
    throw new BadRequestError('このURLは使用できません');
  }
  return fetch(url, { redirect: 'error' }); // リダイレクト禁止
}
```

### エラーハンドリング

- 内部エラーの詳細はログ（Vercel Logs）に記録、ユーザーには汎用的なメッセージのみ返却
- スタックトレースはレスポンスに含めない
- 認証エラーは401、認可エラーは403、入力エラーは400で統一

---

## スケーラビリティ設計

### データ増加への対応

| 想定データ量 | 対応 |
|-------------|------|
| LGTM画像 1万件まで | 現構成のまま（pHash全件突き合わせは数十ms以内） |
| LGTM画像 10万件以上 | pgvectorに移行してハミング距離検索を高速化 |
| ユーザー 1万人 | 現構成のまま（Supabase無料枠の範囲内） |
| Vercel Blob 1GB超 | 有料プランへ移行 or 古い画像のアーカイブ戦略を策定 |

### 機能拡張性

- **API拡張**: Route Handler の追加で対応、既存APIは破壊的変更を避ける
- **画像処理拡張**: Sharpパイプラインに合成ステップを追加（フォントカスタマイズ等）
- **認証プロバイダー追加**: Supabase Auth設定で Google / Twitter 等を追加可能（MVP外）

### レンダリング戦略（Cache Components / Partial Prerendering）

Next.js 16 の **Cache Components**（Next.js 15 までの実験的 PPR を安定化・再設計したもの）を採用し、トップページを Partial Prerender 化する（Issue #54）。

- **有効化**: `next.config.ts` で `cacheComponents: true`（グローバルフラグ。Next.js 15 の `experimental.ppr` / ルート単位の `experimental_ppr` は廃止）
- **トップページ（`app/(site)/`）**: ページ骨格・ヒーロー文言・グリッドスケルトンを静的シェルとしてビルド時にプリレンダーし、エッジキャッシュから即時配信する。`Header`（認証依存・動的）と `HomeContent`（画像一覧）は `<Suspense>` 境界でストリーミングする
- **初期画像一覧のキャッシュ**: `src/lib/cache/list-home-images.ts` の `getHomeImagesInitial` を `'use cache'` ディレクティブ化する。
  - `cacheTag('lgtm-images:list')` でタグ付け、`cacheLife('max')` で寿命を最長化
  - 無効化は `revalidateTag('lgtm-images:list', 'max')` に委ねる（第2引数のプロファイル必須）
  - `'use cache'` 配下では `cookies()` を呼べないため、Cookie 非依存の `createAnonClient` を採用
  - RLS の `"anyone can view active images"` ポリシーで匿名 SELECT を担保
- **`cacheComponents` 互換のための準拠**: `export const dynamic = 'force-dynamic'` はグローバルフラグと非互換のため、動的化が必要なルートは `connection()` で明示的に prerender を抑止する（`app/api/images/random/route.ts`）。dynamic なページ（`/images/[id]`・`/images/new`）には `loading.tsx` で Suspense 境界（静的シェル）を用意する
- **proxy 化**: Next.js 16 で `middleware.ts` → `proxy.ts` にリネーム（ファイル名に加え、エクスポート関数名も `middleware` → `proxy` に変更）。`proxy.ts` は Node.js runtime 前提で `runtime: 'edge'` 指定は非対応（エラー）。本プロジェクトの `@supabase/ssr` `createServerClient` は Node.js runtime デフォルトで影響なし

> 本番計測（2026-06-09, `hnd1`）: `x-nextjs-prerender: 1` / `x-vercel-cache: HIT` で静的シェルのエッジ配信を確認。LCP 中央値 89ms・TTFB（エッジ HIT）10〜70ms・CLS 0.00 と Core Web Vitals はすべて Good 圏内（Issue #54 完了）。

### キャッシュ戦略

- **静的アセット**: Next.js / Vercel Edge Network が自動でCDNキャッシュ
- **画像本体（Vercel Blob）**: Cache-Control: `public, max-age=31536000, immutable`（URL変更時は再生成）
- **画像一覧API**: `Cache-Control: s-maxage=60, stale-while-revalidate=300`（60秒キャッシュ＋5分リバリデート）
- **画像ランダム取得API（`GET /api/images/random`）**: `Cache-Control: no-store` ＋ `connection()` による動的化。押下のたびに別の 16 枚を返す要件のため、ルート単位・レスポンス双方でキャッシュしない（Issue #109）。`cacheComponents` 有効化に伴い `dynamic = 'force-dynamic'` から `connection()` へ移行（Issue #54）

#### 論理削除とキャッシュの関係

`Cache-Control: immutable` を採用しているため、論理削除（`status = 'deleted'`）後もブラウザ・CDN キャッシュ期間中は Blob URL への直アクセスで画像が表示されうる。

**設計選択**:
- 一覧 API・お気に入り一覧 API は `active` のみを返す（RLS ポリシーで担保）ため、ユーザー導線上は削除済み画像へ到達できない
- CDN キャッシュの能動的な無効化は実装しない（Blob URL 単位のパージは Vercel 側でコストが高く、MVP の運用範囲には過剰）
- 不適切コンテンツの即時排除が必要な場合は管理者削除（PRD機能6）が Blob を即時物理削除するため、キャッシュ期間中であっても URL 自体が 404 となり実害は限定される

> TODO（将来対応）: 一般ユーザー削除でも即時の CDN 無効化が必要になった場合は、Vercel Blob の `del()` を即時実行する選択肢を再評価する。

### モニタリング・可観測性

#### アクセス計測 / Web Vitals (実装済み)

- **計測基盤**: Vercel Analytics + Speed Insights。`app/layout.tsx` で `<Analytics />` / `<SpeedInsights />` を `<body>` 末尾にマウントしている
- **対象パッケージ**: `@vercel/analytics`（PV / 訪問者 / リファラ）/ `@vercel/speed-insights`（Web Vitals: LCP / CLS / INP）
- **環境分岐**: パッケージ側で `process.env.NODE_ENV` を判定する（明示的な分岐コードは持たない）。`production` ビルドでは `/_vercel/insights/script.js` を、`development` ではデバッグ版（`https://va.vercel-scripts.com/v1/script.debug.js`）をロードする。デバッグ版でもイベントは送信され、ダッシュボード上で development として区別記録される
- **データの確認先**: Vercel ダッシュボードの該当プロジェクト（Analytics / Speed Insights タブ）。KPI 計測の正本として PRD KPI セクションと同期する。MAU 等の KPI を読むときは `environment = production` フィルタを適用し、Preview / Development のアクセスを除外する
- **ダッシュボード有効化**: Vercel プロジェクト設定で Analytics / Speed Insights を ON にする運用（リポジトリ管理者操作）

#### その他のモニタリング (TODO)

> TODO（将来対応）: エラー追跡・ログ集約・容量アラートの設計を以下の方針で具体化する。MVP 期間中はダッシュボード手動確認で運用する。
>
> - **エラー追跡**: Vercel Logs で Route Handler の例外を確認。重大度フィルタとアラート条件は P1 で定義
> - **DB 監視**: Supabase ダッシュボードで容量（500MB 上限）・接続数・スロークエリを定期確認
> - **Blob 容量**: Vercel Blob ダッシュボードで 1GB 上限の80% 到達時にアラートを設定
> - **アラート連携**: P1 で Slack または GitHub Issue 自動起票への配線を検討

---

## テスト戦略

### ユニットテスト

- **フレームワーク**: Vitest 3.x
- **対象**:
  - `src/services/**` のビジネスロジック
  - `src/lib/image/**` のpHash計算・LGTM合成・SSRF検証
  - `src/lib/validation/**` のzodスキーマ
- **カバレッジ目標**: `src/services/**` 90% / `src/lib/**` 80%
  - 詳細な閾値設定は `docs/development-guidelines.md` の `vitest.config.ts` を参照

### 統合テスト

- **方法**: Vitest + Supabase Local（Docker）でDBを実起動して検証
- **対象**:
  - API Route の正常系・異常系
  - RLSポリシーが意図通り動作すること
  - DB制約（UNIQUE等）の検証

### E2Eテスト

- **ツール**: Playwright 1.5x
- **シナリオ**（最小）:
  1. 未ログインで一覧表示・マークダウンコピーができる
  2. GitHub OAuthログイン後、画像URLを登録すると一覧に表示される
  3. お気に入り追加・解除が動作する
  4. 自分の画像を削除すると一覧から消える
- **実行環境**: ローカル + GitHub Actions（PR時）

---

## 技術的制約

### 環境要件

- **OS（開発）**: macOS / Linux / WSL2（Sharpはネイティブバイナリを使用）
- **OS（実行）**: Vercel Functions（Linux x64）
- **必要メモリ**: 開発時 4GB 以上推奨（Supabase Local で Docker を起動するため）
- **必要な外部依存**:
  - GitHub OAuth App（Client ID / Secret 取得）
  - Supabase プロジェクト
  - Vercel アカウント・Blob ストア

### パフォーマンス制約

- Vercel Function のタイムアウト 10秒（無料プラン）
- Vercel Blob 無料枠 1GB / 月の帯域 10GB
- Supabase 無料枠 DB 500MB / ストレージ 1GB / 月のリクエスト数制限

### セキュリティ制約

- `SUPABASE_SERVICE_ROLE_KEY` は絶対にクライアントに露出しない
- 環境変数は Vercel Dashboard で管理し、リポジトリには `.env.example` のみ配置
- `.env.local` は `.gitignore` で除外

---

## 依存関係管理

### バージョン管理方針

```json
{
  "dependencies": {
    "next": "~16.2.0",                 // パッチ固定（マイナー以上は手動アップデート）
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.10.0",
    "@vercel/blob": "^2.3.0",
    "sharp": "^0.34.0",
    "zod": "^4.4.0",
    "tailwindcss": "^4.2.0"
  },
  "devDependencies": {
    "typescript": "~6.0.3",
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0",
    "@biomejs/biome": "^2.4.0",
    "lefthook": "^2.1.0",
    "supabase": "^2.0.0"
  }
}
```

**方針**:
- ランタイム依存は `^` でマイナーアップを許容、Next.jsのみパッチ固定（`~16.2.0`）
- TypeScript はパッチのみ自動更新（`~`）
- 依存関係の更新 PR は Renovate App が自動で作成する（`renovate.json` 参照、運用ポリシーは `docs/development-guidelines.md`「依存関係管理 (Renovate)」セクション）
- pnpm audit を CI で実行し、High 以上の脆弱性検出時は失敗扱い

**注意事項（メジャーバージョンが古いドキュメント想定から更新されたパッケージ）**:
- `@supabase/ssr` v0.10 系: Cookie ハンドラが `getAll/setAll` ベース（旧 `get/set/remove` から変更）
- `@vercel/blob` v2 系: `put()` のシグネチャが v0.x から変更。実装時に [公式ドキュメント](https://vercel.com/docs/storage/vercel-blob) を確認
- `zod` v4 系: `z.string().url()` の挙動など一部の API が v3 から変更。`development-guidelines.md` のサンプルは v4 互換

### 主要ライブラリのライセンス

| ライブラリ | ライセンス | 商用利用 |
|-----------|----------|---------|
| Next.js | MIT | ✅ |
| Sharp | Apache-2.0 | ✅ |
| Supabase JS | MIT | ✅ |
| Vercel Blob | Apache-2.0 | ✅ |
| Tailwind CSS | MIT | ✅ |

すべてMIT/Apache-2.0で商用利用可能。
