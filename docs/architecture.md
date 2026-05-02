# 技術仕様書 (Architecture Design Document)

## テクノロジースタック

### 言語・ランタイム

| 技術 | バージョン | 選定理由 |
|------|-----------|----------|
| Node.js | v24.11.0 | CLAUDE.mdで指定。Next.js 15のサポート対象、非同期I/Oに優れSharpの画像処理を高速に実行可能 |
| TypeScript | 6.x | CLAUDE.mdで指定。静的型付けでバグを早期検出、Supabase / Next.jsの型生成が充実 |
| npm | 11.x | CLAUDE.mdで指定。Node.js v24に標準搭載で追加インストール不要 |

### フレームワーク・ライブラリ

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| Next.js | 15.x | フルスタックフレームワーク | App Router採用でSSR・APIルート・画像最適化を統合的に提供。Vercelとの親和性が最高 |
| React | 19.x | UIライブラリ | Next.js 15が要求。Server Components対応 |
| Tailwind CSS | 4.x | スタイリング | ユーティリティクラスで高速にUI構築、デザイントークンの一元管理が容易 |
| Sharp | 0.34.x | 画像処理 | LGTM文字合成・WebP変換・リサイズ・pHash計算をNode.js上で高速処理 |
| @supabase/supabase-js | 2.x | DB・認証クライアント | Supabase公式SDK、TypeScript型生成と統合 |
| @supabase/ssr | 0.5.x | Next.js SSR用ヘルパー | Server Components / Route Handlerでセッション管理 |
| @vercel/blob | 0.27.x | CDNストレージクライアント | Vercel Blob公式SDK、サーバーサイドからのアップロード対応 |
| zod | 3.x | スキーマバリデーション | APIリクエストの型安全な検証、Supabaseと組み合わせて入力検証 |

### 開発ツール

| 技術 | バージョン | 用途 | 選定理由 |
|------|-----------|------|----------|
| ESLint | 9.x | リンター | Next.js標準のコード品質チェック |
| Prettier | 3.x | フォーマッター | コードスタイルの統一 |
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
| 画像一覧の初期表示（20件） | 3秒以内 | **LCP（Largest Contentful Paint）** | Vercel Edge Network、3G相当回線 | Lighthouse / Vercel Analytics |
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

### キャッシュ戦略

- **静的アセット**: Next.js / Vercel Edge Network が自動でCDNキャッシュ
- **画像本体（Vercel Blob）**: Cache-Control: `public, max-age=31536000, immutable`（URL変更時は再生成）
- **画像一覧API**: `Cache-Control: s-maxage=60, stale-while-revalidate=300`（60秒キャッシュ＋5分リバリデート）

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
    "next": "15.x.x",                  // 完全固定（メジャーアップは慎重に）
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0",
    "@vercel/blob": "^0.27.0",
    "sharp": "^0.34.0",
    "zod": "^3.23.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "~6.0.0",
    "vitest": "^3.0.0",
    "@playwright/test": "^1.50.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0",
    "supabase": "^2.0.0"
  }
}
```

**方針**:
- ランタイム依存は `^` でマイナーアップを許容、Next.jsのみメジャー固定
- TypeScript はパッチのみ自動更新（`~`）
- セキュリティアップデートは Dependabot で週次チェック
- npm audit を CI で実行し、High 以上の脆弱性検出時は失敗扱い

### 主要ライブラリのライセンス

| ライブラリ | ライセンス | 商用利用 |
|-----------|----------|---------|
| Next.js | MIT | ✅ |
| Sharp | Apache-2.0 | ✅ |
| Supabase JS | MIT | ✅ |
| Vercel Blob | Apache-2.0 | ✅ |
| Tailwind CSS | MIT | ✅ |

すべてMIT/Apache-2.0で商用利用可能。

---

## 未解決の改善項目（レビュー指摘事項）

`/review-docs docs/architecture.md`（2026-05-02実施）で指摘された改善項目を以下に記録する。
解消したらチェックを入れ、すべて解消されたら本セクションを削除する。

### 優先度: 高（即時対応）

- [x] **TypeScript バージョンの統一**
  - 問題: CLAUDE.md は `6.x`、本ドキュメントのテクスタックテーブルは `5.x`、依存関係JSONは `~5.6.0` で三者不整合
  - 対応: CLAUDE.md・本ドキュメント（2箇所）・`development-guidelines.md` で同一バージョンに統一する
  - 該当箇所: 「テクノロジースタック > 言語・ランタイム」テーブル / 「依存関係管理 > バージョン管理方針」JSON
  - 解消: 本ドキュメントを `6.x` / `~6.0.0` に更新、`development-guidelines.md` 冒頭に「前提環境」セクションを新設して `6.x` を明記（2026-05-02）

- [x] **カバレッジ目標の数値整合**
  - 問題: 本ドキュメント「主要パス 80% 以上」 vs `development-guidelines.md`「services 90% / lib 80%」で不一致
  - 対応: レイヤー別（services 90% / lib 80%）に揃え、詳細設定は `development-guidelines.md` の `vitest.config.ts` 参照とする
  - 該当箇所: 「テスト戦略 > ユニットテスト > カバレッジ目標」
  - 解消: 本ドキュメントを「services 90% / lib 80%」に更新し、詳細閾値の参照先を `development-guidelines.md` に集約（2026-05-02）

### 優先度: 中（近日対応）

- [ ] **API応答・画像詳細LCPがPRDに存在しない**
  - 問題: 「API応答 500ms/p95」「画像詳細LCP 2秒」が本ドキュメントにのみ存在し、PRDの非機能要件と乖離。「PRDと両方更新」の注記と矛盾
  - 対応: PRDに同項目を追加するか、本ドキュメント側で「サーバー内部指標のため本ドキュメント単独管理」と意図的乖離を明示する
  - 該当箇所: 「パフォーマンス要件 > レスポンスタイム」テーブル

- [ ] **CI/CD記述の重複解消**
  - 問題: 本ドキュメント（2行の概要） vs `development-guidelines.md`（GitHub Actions yaml全体）で記述が分散
  - 対応: 本ドキュメントは概要に留め、「詳細は `docs/development-guidelines.md` を参照」と明示
  - 該当箇所: 「デプロイ・実行環境 > CI/CD」

- [ ] **Vercel Blob 物理削除ジョブのスコープ明示**
  - 問題: 「MVP後に検討」とあるが、実行主体・タイミング・失敗時挙動が未定義
  - 対応: 「MVP期間中は物理削除しない / P1フェーズで日次クリーンアップジョブ実装」と明示する
  - 該当箇所: 「データ永続化戦略 > バックアップ戦略 > Vercel Blob」

- [x] **`src/lib/errors.ts` をリポジトリ構造に追記**
  - 問題: 本ドキュメントのSSRFコードが参照する `BadRequestError` のソースが `repository-structure.md` に未記載
  - 対応: `repository-structure.md` の `src/lib/` ツリーに `errors.ts` を追記（隣接ドキュメントの修正）
  - 該当箇所: `repository-structure.md` 側の修正だが、本ドキュメントで顕在化
  - 解消: `repository-structure.md` に `errors.ts` を追加し、`development-guidelines.md` のエラーハンドリング規約に集約方針を明記（2026-05-02）

### 優先度: 低（将来対応）

- [ ] **モニタリング/可観測性セクションの追加**
  - 問題: エラー追跡・ログ集約・容量アラートの設計が未定義
  - 対応: 「モニタリング」セクションを新設し、Vercel Logs / Vercel Analytics / Supabase・Vercel ダッシュボードでの監視対象とアラート条件を記述する

- [ ] **論理削除とCDNキャッシュ無効化の関係を文書化**
  - 問題: `Cache-Control: immutable` キャッシュと論理削除の組み合わせで、削除済み画像がブラウザキャッシュから読み込まれる可能性が未定義
  - 対応: 「UIフィルタのみで制御し、CDN無効化は行わない」等の設計選択を「キャッシュ戦略」に追記
  - 該当箇所: 「スケーラビリティ設計 > キャッシュ戦略」

> 出典: `/review-docs docs/architecture.md` 実施結果（doc-reviewer サブエージェント、総合スコア 3.9/5）
