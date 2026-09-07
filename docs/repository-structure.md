# リポジトリ構造定義書 (Repository Structure Document)

## プロジェクト構造

> 本ツリーは **実在するファイルのみ** を列挙する。未実装機能のために追加予定のファイルは、末尾の「P1フェーズで追加予定のファイル」に分離している。生成物・gitignore 対象（`.next/` `coverage/` `playwright-report/` `test-results/` `.vercel/` 等）、`.gitkeep`、およびサブディレクトリ配下の `.gitignore` は省略する。
>
> 未実装であることの表記は `> **未実装**:` ブロック（節全体が未実装の場合）と行内の `（未実装 / #Issue番号）`（一部の記述のみが未実装の場合）の2種類に統一し、Issue へのハイパーリンクはブロック側にのみ付ける。他の docs も同じ規約に従う。

```
lgtmhub/
├── app/                        # Next.js App Router（Presentation + API Layer）
│   ├── (site)/                 # 画面グループ（レイアウト共有）
│   │   ├── layout.tsx          # 共通レイアウト（ヘッダー・お気に入り Provider）
│   │   ├── page.tsx            # 画像一覧トップページ
│   │   ├── favorites/
│   │   │   └── page.tsx        # お気に入り一覧画面
│   │   └── images/
│   │       ├── new/
│   │       │   ├── page.tsx        # 画像登録フォーム
│   │       │   └── loading.tsx     # 登録画面のローディングUI
│   │       └── [id]/
│   │           ├── page.tsx        # 画像詳細ページ
│   │           └── loading.tsx     # 詳細画面のローディングUI
│   ├── api/                    # API Layer（Route Handlers）
│   │   ├── CLAUDE.md               # Route Handler の実装規約
│   │   ├── auth/
│   │   │   ├── callback/route.ts       # GitHub OAuth コールバック
│   │   │   └── test-signin/route.ts    # E2E 用テストサインイン
│   │   ├── favorites/
│   │   │   ├── route.ts                # GET（一覧）/ POST（追加）
│   │   │   ├── ids/route.ts            # GET（お気に入り済み画像ID一覧）
│   │   │   └── [lgtmImageId]/route.ts  # DELETE（解除）
│   │   └── images/
│   │       ├── route.ts                # GET（一覧）/ POST（登録）
│   │       ├── random/route.ts         # GET（ランダム取得、no-store）
│   │       └── [id]/
│   │           ├── route.ts            # DELETE（削除）
│   │           └── regenerate/route.ts # POST（再生成、管理者限定）
│   ├── globals.css
│   └── layout.tsx              # ルートレイアウト
├── src/                        # ビジネスロジック・ユーティリティ
│   ├── CLAUDE.md               # src 配下の実装規約
│   ├── services/               # Service Layer（ビジネスロジック）
│   │   ├── image-service.ts
│   │   ├── favorite-service.ts
│   │   └── user-profile-service.ts
│   ├── repositories/           # Data Layer（DB・Blob アクセス）
│   │   ├── image-repository.ts
│   │   ├── favorite-repository.ts
│   │   ├── daily-upload-count-repository.ts
│   │   └── user-profile-repository.ts
│   ├── lib/                    # 技術ユーティリティ（フレームワーク非依存）
│   │   ├── errors.ts               # ドメインエラークラス集約
│   │   ├── utils.ts                # className 結合等の汎用ヘルパー
│   │   ├── auth/
│   │   │   ├── actions.ts          # GitHub OAuth サインイン/アウト Server Action
│   │   │   └── require-admin.ts    # 管理者ロールの検証
│   │   ├── cache/
│   │   │   └── list-home-images.ts # トップページ一覧のキャッシュ境界
│   │   ├── image/
│   │   │   ├── compose-lgtm.ts     # LGTM文字合成
│   │   │   ├── calculate-phash.ts  # pHash計算
│   │   │   └── validate-image.ts   # フォーマット・サイズ検証
│   │   ├── http/
│   │   │   └── safe-fetch.ts       # SSRF対策付きfetch
│   │   ├── profile/
│   │   │   └── resolve-uploader-display.ts # 投稿者の表示名・アバター解決
│   │   ├── validation/             # zod スキーマ集約（API入力検証）
│   │   │   ├── image.ts            # 画像登録・削除リクエスト
│   │   │   ├── favorite.ts         # お気に入りAPIの入出力スキーマ
│   │   │   └── create-image-error.ts # 登録APIエラー → UIメッセージ変換
│   │   └── supabase/
│   │       ├── client.ts           # クライアントサイドSupabase
│   │       ├── server.ts           # サーバーサイドSupabase
│   │       └── anon.ts             # 匿名（未認証）向けSupabase
│   └── types/                  # 共通型定義
│       ├── image.ts
│       ├── favorite.ts
│       ├── user.ts
│       └── database.types.ts   # Supabaseスキーマから自動生成（pnpm run db:types）
├── components/                 # 再利用可能なReactコンポーネント
│   ├── ui/                     # 汎用UIプリミティブ
│   │   ├── button.tsx
│   │   └── alert-dialog.tsx
│   ├── header.tsx              # グローバルヘッダー
│   ├── header-skeleton.tsx     # ヘッダーのローディングスケルトン
│   ├── home-content.tsx        # トップページ本体（一覧とアクションの組み立て）
│   ├── home-images.tsx         # トップページの画像一覧（ストリーミング境界）
│   ├── image-card.tsx          # 画像カード（サムネイル + お気に入り / コピーボタン）
│   ├── image-grid.tsx          # 画像グリッド一覧
│   ├── image-grid-skeleton.tsx # グリッドのローディングスケルトン
│   ├── image-detail-actions.tsx    # 詳細ページの操作群（削除等）
│   ├── image-regenerate-action.tsx # 再生成操作（管理者限定）
│   ├── image-register-form.tsx # 画像登録フォーム
│   ├── copy-markdown-button.tsx # マークダウンコピーボタン
│   ├── favorite-store.ts       # お気に入り状態のモジュールストア（ID集合・楽観更新）
│   ├── favorite-toaster.tsx    # お気に入り操作失敗のトースト表示
│   ├── favorite-button.tsx     # お気に入りボタン（ハートアイコン）
│   ├── favorites-content.tsx   # お気に入り一覧の本体（認証確認 + 初期取得）
│   ├── favorite-images.tsx     # お気に入り一覧の描画（空状態 / グリッド）
│   ├── load-more-button.tsx    # カーソルページネーションの追加読み込み
│   └── uploader-profile-row.tsx # 投稿者プロフィールの表示行
├── supabase/                   # Supabase設定・マイグレーション
│   ├── CLAUDE.md               # マイグレーション運用の規約
│   ├── migrations/             # SQLマイグレーションファイル
│   │   ├── 20260503000000_create_user_profiles.sql
│   │   ├── 20260504000000_create_lgtm_images.sql
│   │   ├── 20260504000001_create_daily_upload_counts.sql
│   │   ├── 20260506000000_extend_lgtm_images_select_policy.sql
│   │   ├── 20260512000000_bootstrap_admin_kakikubo.sql
│   │   ├── 20260626000000_add_lgtm_images_is_animated.sql
│   │   ├── 20260720000000_restrict_user_profiles_column_grants.sql
│   │   └── 20260820000000_create_favorites.sql
│   ├── seed.sql                # 開発用シードデータ
│   ├── config.toml             # Supabase Local設定
│   └── .env.example            # Supabase CLI 用環境変数テンプレート
├── tests/                      # テストコード
│   ├── unit/                   # ユニットテスト（Vitest）
│   │   ├── api/                # Route Handler のテスト
│   │   │   ├── auth-callback.test.ts
│   │   │   ├── auth-test-signin.test.ts
│   │   │   ├── images/         # 一覧 / 登録 / 削除 / ランダム / 再生成
│   │   │   └── favorites/      # 一覧 / 追加 / 解除 / ID一覧
│   │   ├── components/         # コンポーネントテスト（happy-dom）
│   │   │   └── _helpers.ts     # 共通のレンダリングヘルパー
│   │   ├── lib/                # auth / http / image / profile / validation / errors
│   │   ├── repositories/
│   │   └── services/
│   ├── integration/            # 統合テスト（Vitest + Supabase Local）※現在はディレクトリ枠のみ
│   ├── e2e/                    # E2Eテスト（Playwright）
│   │   ├── global-setup.ts     # 認証済みストレージステートの事前生成
│   │   ├── smoke.test.ts
│   │   ├── auth.test.ts
│   │   ├── auth-callback.test.ts
│   │   ├── image-list.test.ts
│   │   ├── image-detail.test.ts
│   │   ├── image-register.test.ts
│   │   ├── image-deletion.test.ts
│   │   ├── favorites.test.ts               # 未ログイン視点
│   │   └── favorites-authenticated.test.ts # ログイン済み（authenticated プロジェクト専用）
│   └── setup/
│       └── component-setup.ts  # コンポーネントテストのグローバルセットアップ
├── public/                     # 静的アセット
│   ├── default-avatar.svg
│   └── fonts/                  # LGTM合成用フォント（比較検討用の _preview/ を含む）
├── scripts/                    # 開発・運用スクリプト
│   ├── preview-lgtm-fonts.ts   # LGTM合成フォントの比較プレビュー生成
│   └── supabase-migrate-to-tokyo.sh # Supabase リージョン移設の補助
├── docs/                       # プロジェクトドキュメント
│   ├── ideas/                  # 壁打ち・アイデアメモ
│   ├── product-requirements.md
│   ├── functional-design.md
│   ├── architecture.md
│   ├── repository-structure.md
│   ├── development-guidelines.md
│   └── glossary.md
├── .github/                    # GitHub設定
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── release-drafter.yml     # リリースノート生成ルール
│   └── workflows/
│       ├── ci.yml              # Lint/型チェック/テスト/E2E（development-guidelines.md参照）
│       ├── danger.yml          # PR サイズ警告（dangerfile.js を実行）
│       ├── release-drafter.yml # リリースドラフトの更新
│       ├── supabase-deploy.yml # 本番へのマイグレーション適用
│       ├── supabase-preview-migrate.yml # Preview 環境へのマイグレーション適用
│       └── _supabase-push.yml  # 上記2つから呼ばれる再利用ワークフロー
├── .claude/                    # Claude Code設定（agents / commands / steering）
├── .devcontainer/              # devcontainer 設定
├── .steering/                  # 作業単位のタスク管理
├── .env.example                # 環境変数テンプレート（git管理）
├── .gitignore
├── .npmrc                      # pnpm の挙動設定
├── .coderabbit.yaml            # CodeRabbit レビュー設定
├── biome.json                  # Biome (Linter + Formatter) 設定
├── codecov.yml                 # Codecov のカバレッジ設定
├── components.json             # UIプリミティブ生成ツールの設定
├── dangerfile.js               # Danger スクリプト（PRの大きさの目安チェック）
├── global.d.ts                 # プロジェクト全体の型宣言
├── lefthook.yml                # Git hooks（コミット時の Biome 実行）
├── next-env.d.ts               # Next.js が自動生成する型参照（編集禁止）
├── next.config.ts
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml         # pnpm の allowBuilds 等の設定
├── postcss.config.mjs          # Tailwind CSS の PostCSS プラグイン設定
├── proxy.ts                    # Supabase セッションリフレッシュ（cookies 伝播、旧 middleware.ts）
├── renovate.json               # 依存更新の自動 PR 設定
├── tsconfig.json
├── vercel.json                 # Vercel のビルド・関数設定
├── vitest.config.ts
├── CLAUDE.md
├── LICENSE
└── README.md
```

---

## ディレクトリ詳細

### `app/` (Presentation Layer + API Layer)

**役割**: Next.js App Routerのファイルベースルーティング。画面コンポーネント（Server/Client Components）とHTTP APIエンドポイント（Route Handlers）を配置する。

**配置ファイル**:
- `page.tsx`: ページコンポーネント（Server Component）
- `layout.tsx`: レイアウトコンポーネント
- `route.ts`: API Route Handler（GET/POST/DELETE等を named export で定義）
- `loading.tsx`: ローディングUI
- `error.tsx`: エラーUI

**命名規則**:
- ファイル名はNext.js規約に従い小文字
- ルートグループは `(name)` 形式
- 動的ルートは `[param]` 形式

**依存関係**:
- 依存可能: `src/services/`（Server Components・Route Handlersから直接）、`components/`、`src/types/`、`src/lib/`
- 依存禁止: `src/repositories/`（Service Layerを経由する）

**例**:
```
app/api/images/route.ts  →  src/services/image-service.ts  →  src/repositories/image-repository.ts
```

**例外: `app/api/auth/callback/route.ts`**:
- GitHub OAuth のコールバック処理のみを担い、Supabase Auth のセッション確立に必要な `src/lib/supabase/server.ts` を直接利用する
- ビジネスロジックを含まないため `src/services/` を経由しない（経由する必要のあるロジックも存在しない）
- 認証コールバックは Next.js / Supabase の規約に従った実装が必要であり、本ルートのみ Service Layer 経由ルールから明示的に除外する

---

### `src/services/` (Service Layer)

**役割**: ビジネスロジックを実装する。HTTP / UIへの依存を持たない純粋なサービス層。

**配置ファイル**:
- `image-service.ts`: 画像登録・削除・一覧取得のオーケストレーション
- `favorite-service.ts`: お気に入りの追加・解除・一覧取得・お気に入り済み画像 ID 取得
- `user-profile-service.ts`: ユーザープロフィールの単一 / 複数取得 (画像一覧の N+1 回避を含む)

**命名規則**:
- ファイル名: `{機能名}-service.ts`（kebab-case）
- クラス名: `ImageService`（PascalCase）

**依存関係**:
- 依存可能: `src/repositories/`、`src/lib/`、`src/types/`
- 依存禁止: `app/`、`components/`（HTTPレスポンスやReactへの依存禁止）

**例**:
```
src/services/
├── image-service.ts        # 画像登録（取得→検証→重複チェック→合成→保存→DB）
├── favorite-service.ts     # お気に入り（画像の存在検証→登録 / 解除 / 一覧）
└── user-profile-service.ts # ユーザープロフィール取得（単一 / 複数）
```

---

### `src/repositories/` (Data Layer)

**役割**: Supabase DB / Vercel Blob / 外部HTTPリクエストを抽象化する。SQLクエリとストレージアクセスをここに閉じ込める。

**配置ファイル**:
- `image-repository.ts`: `lgtm_images` テーブルのCRUD、pHash検索
- `favorite-repository.ts`: `favorites` テーブルのCRUD、`lgtm_images` との内部結合による一覧取得
- `daily-upload-count-repository.ts`: 日次カウントのUPSERT・取得
- `user-profile-repository.ts`: `user_profiles` テーブルの取得（単一 / 複数）

**命名規則**:
- ファイル名: `{エンティティ名}-repository.ts`（kebab-case）
- クラス名: `ImageRepository`（PascalCase）

**依存関係**:
- 依存可能: `src/lib/supabase/`、`src/types/`
- 依存禁止: `src/services/`、`app/`、`components/`

---

### `src/lib/` (技術ユーティリティ)

**役割**: フレームワーク非依存の技術ライブラリ。画像処理・SSRF対策・Supabaseクライアントなど、他のレイヤーから横断的に利用される処理を配置。

**サブディレクトリ・主要ファイル**:

| パス | 役割 |
|------|------|
| `errors.ts` | ドメインエラークラス（`AppError` / `NotFoundError` 等）の集約。新規エラーは必ずここに追加する |
| `utils.ts` | className 結合などフレームワーク非依存の汎用ヘルパー |
| `auth/` | GitHub OAuth のサインイン / サインアウト Server Action、管理者ロールの検証（`require-admin.ts`） |
| `cache/` | `cacheComponents` 前提のキャッシュ境界関数（トップページ一覧の取得など） |
| `image/` | Sharp を使った画像合成・pHash計算・フォーマット検証 |
| `http/` | SSRF対策付きfetch、プライベートIP検証 |
| `profile/` | 投稿者の表示名・アバターの解決（プロフィール未取得時のフォールバック含む） |
| `validation/` | zod スキーマの集約。Route Handler から import して入力検証に利用する。スキーマはエンドポイント単位ではなくドメイン単位で配置する。スキーマに付随する入出力変換の純関数 (例: API エラーレスポンス → UI メッセージのマッピング＝`create-image-error.ts`) も同居して良い |
| `supabase/` | Server / Client / 匿名（未認証）向けSupabaseクライアント初期化 |

**命名規則**:
- ファイル名: `{動詞}-{対象}.ts`（kebab-case）
- 例: `compose-lgtm.ts`, `calculate-phash.ts`, `safe-fetch.ts`

**依存関係**:
- 依存可能: `src/types/`、外部npm
- 依存禁止: `src/services/`、`src/repositories/`（循環防止）

---

### `src/types/` (型定義)

**役割**: プロジェクト全体で使う TypeScript 型・インターフェースを集約。

**配置ファイル**:
- `image.ts`: `LgtmImage` インターフェース、`ImageStatus` 型
- `favorite.ts`: `Favorite` インターフェース
- `user.ts`: `UserProfile` インターフェース
- `database.types.ts`: Supabase スキーマから自動生成された型定義（`pnpm run db:types` で生成）

**命名規則**:
- ファイル名: `{エンティティ名}.ts`（kebab-case または単数形）
- 自動生成ファイル: `database.types.ts`（生成器の出力名に合わせる）

**自動生成ファイルの扱い**:
- `database.types.ts` は **コミット対象**（マイグレーションと同期させ、CI で型チェックの対象にするため）
- マイグレーション変更後は `pnpm run db:types` を実行し、再生成された型を必ずコミットに含める

**依存関係**:
- 依存可能: なし（型定義のみ）
- 依存禁止: すべての実装レイヤー（型は依存関係の末端に位置する）

---

### `components/` (Reactコンポーネント)

**役割**: 再利用可能な React コンポーネント。ページ固有のコンポーネントは `app/` 配下に置き、複数ページで使うものだけここに配置する。

**サブディレクトリ**:

| ディレクトリ | 役割 |
|------------|------|
| `ui/` | 汎用UIプリミティブ。shadcn/ui CLI（`components.json`）で生成し、実体は Base UI（`@base-ui/react`）のラッパー。現在は `button.tsx` / `alert-dialog.tsx` の2つ |
| （ルート直下） | ドメイン固有の共有コンポーネント。ローディング表示は `*-skeleton.tsx` として対になるコンポーネントの隣に置く |

**命名規則**:
- ファイル名: `{機能名}.tsx`（kebab-case）
- コンポーネント名: `ImageCard`（PascalCase）

**依存関係**:
- 依存可能: `src/types/`、`src/lib/supabase/client.ts`（クライアントコンポーネントのみ）
- 依存禁止: `src/services/`、`src/repositories/`（APIを経由するか Server Component 経由で渡す）

---

### `supabase/` (DBマイグレーション)

**役割**: Supabase CLIで管理するDBスキーマのマイグレーションとローカル設定。

**命名規則**:
- マイグレーションファイル: `YYYYMMDDHHMMSS_{説明}.sql`（Supabase CLIが自動付与）
- 例: `20260503000000_create_user_profiles.sql`

**注意**:
- マイグレーションは一度適用したら変更しない（新しいマイグレーションで修正）
- `config.toml` でポート・サービス設定を管理（ローカル開発用）

---

### `tests/` (テストコード)

**役割**: ソースコードとテストコードを分離し、テストタイプごとにディレクトリを分割する。

**構造**:

```
tests/
├── unit/           # Vitest、依存をモック、高速
│   ├── api/            # Route Handler（app/api/** に対応）
│   ├── components/     # コンポーネント（happy-dom 環境）
│   ├── lib/            # src/lib/** に対応
│   ├── repositories/   # src/repositories/** に対応
│   └── services/       # src/services/** に対応
├── integration/    # Vitest + Supabase Local（Docker）、DB実起動
├── e2e/            # Playwright、ブラウザ自動化
└── setup/          # テスト環境のグローバルセットアップ
```

> **注**: `tests/integration/` は現時点でディレクトリ枠のみで実テストを持たない。API の正常系・異常系は `tests/unit/api/` で Supabase クライアントをモックして検証している。RLS ポリシーや DB 制約の実起動検証が必要になった時点で本ディレクトリに追加する。

**命名規則**:
- ユニット / 統合テスト: `{対象ファイル名}.test.ts`（コンポーネントは `.test.tsx`）
- E2Eテスト: `{ユーザーシナリオ}.test.ts`
- テスト専用のヘルパーは `_` 始まり（例: `tests/unit/components/_helpers.ts`）とし、テストファイルとして収集されないようにする

**対応関係**:
| ソース | テスト |
|--------|--------|
| `src/lib/image/compose-lgtm.ts` | `tests/unit/lib/image/compose-lgtm.test.ts` |
| `src/services/image-service.ts` | `tests/unit/services/image-service.test.ts` |
| `src/repositories/image-repository.ts` | `tests/unit/repositories/image-repository.test.ts` |
| `app/api/images/route.ts` | `tests/unit/api/images/list-route.test.ts` / `create-route.test.ts` |
| `app/api/favorites/route.ts` | `tests/unit/api/favorites/list-route.test.ts` / `create-route.test.ts` |
| `components/image-card.tsx` | `tests/unit/components/image-card.test.tsx` |
| `components/favorite-store.ts` | `tests/unit/components/favorite-store.test.tsx` |
| 未ログインで閲覧・コピー | `tests/e2e/image-list.test.ts` |
| ログイン済みでお気に入り登録・解除 | `tests/e2e/favorites-authenticated.test.ts` |

---

## ファイル配置規則

### ソースファイル

| ファイル種別 | 配置先 | 命名規則 | 例 |
|------------|--------|---------|-----|
| ページコンポーネント | `app/(site)/*/page.tsx` | Next.js規約 | `app/(site)/images/[id]/page.tsx` |
| API Route Handler | `app/api/*/route.ts` | Next.js規約 | `app/api/images/route.ts` |
| 共有Reactコンポーネント | `components/` | kebab-case.tsx | `components/image-card.tsx` |
| ビジネスロジック | `src/services/` | kebab-case-service.ts | `src/services/image-service.ts` |
| DBアクセス | `src/repositories/` | kebab-case-repository.ts | `src/repositories/image-repository.ts` |
| 技術ユーティリティ | `src/lib/` | kebab-case.ts | `src/lib/image/compose-lgtm.ts` |
| 型定義 | `src/types/` | kebab-case.ts | `src/types/image.ts` |
| DBマイグレーション | `supabase/migrations/` | `YYYYMMDDHHMMSS_*.sql` | `20260504000000_create_lgtm_images.sql` |

### 設定ファイル

| ファイル | 役割 |
|---------|------|
| `next.config.ts` | Next.js設定（画像ドメイン許可、`outputFileTracingRoot` 等） |
| `next-env.d.ts` | Next.js が自動生成する型参照ファイル（編集禁止、コミット対象） |
| `global.d.ts` | プロジェクト全体の型宣言（CSS module 等の side-effect import 用） |
| `tsconfig.json` | TypeScript設定（`@/*` パスエイリアス、`strict`、`noUncheckedIndexedAccess`） |
| `vitest.config.ts` | Vitestテスト設定 |
| `playwright.config.ts` | Playwrightテスト設定 |
| `biome.json` | Biome (Linter + Formatter) 設定 |
| `postcss.config.mjs` | Tailwind CSS 4.x の PostCSS プラグイン設定 |
| `components.json` | shadcn/ui CLI の生成設定（`components/ui/` の出力先・エイリアス） |
| `lefthook.yml` | Git hooks 設定（コミット時に Biome を実行） |
| `pnpm-workspace.yaml` | pnpm の `allowBuilds` 等の設定 |
| `vercel.json` | Vercel のビルド・関数設定 |
| `codecov.yml` | Codecov のカバレッジ集計・ステータス設定 |
| `renovate.json` | 依存更新の自動 PR 設定 |
| `.env.example` | 環境変数テンプレート（git管理対象） |
| `.env.local` | ローカル環境変数（**git管理対象外**） |

---

## 命名規則

### ディレクトリ名

| 種別 | 規則 | 例 |
|------|------|-----|
| レイヤーディレクトリ | 複数形、kebab-case | `services/`, `repositories/`, `components/` |
| 機能サブディレクトリ | 単数形または機能名、kebab-case | `image/`, `http/`, `supabase/` |
| Next.jsルートグループ | `(name)` 形式 | `(site)/` |
| Next.js動的ルート | `[param]` 形式 | `[id]/` |

### ファイル名

| 種別 | 規則 | 例 |
|------|------|-----|
| Reactコンポーネント | kebab-case.tsx | `image-card.tsx` |
| サービスクラス | kebab-case-service.ts | `image-service.ts` |
| リポジトリクラス | kebab-case-repository.ts | `image-repository.ts` |
| ユーティリティ関数 | 動詞-対象.ts（kebab-case） | `compose-lgtm.ts`, `safe-fetch.ts` |
| 型定義 | エンティティ名.ts | `image.ts`, `user.ts` |
| テストファイル | `{対象}.test.ts` | `compose-lgtm.test.ts` |

### TypeScript識別子

| 種別 | 規則 | 例 |
|------|------|-----|
| クラス名 | PascalCase | `ImageService`, `ImageRepository` |
| コンポーネント名 | PascalCase | `ImageCard`, `CopyMarkdownButton` |
| インターフェース名 | PascalCase（接頭辞Iなし） | `LgtmImage`, `UserProfile` |
| 型エイリアス | PascalCase | `ImageStatus`, `MimeType` |
| 変数・関数 | camelCase | `composeLgtmImage`, `calculatePHash` |
| 定数（モジュールスコープ） | UPPER_SNAKE_CASE | `DUPLICATE_THRESHOLD`, `MAX_DAILY_UPLOADS` |

---

## 依存関係のルール

### レイヤー間の依存

```
app/ (Presentation + API)
    ↓
src/services/ (Service)
    ↓
src/repositories/ (Data)
    ↓
Supabase / Vercel Blob

components/  →  src/types/（型のみ）
src/lib/     →  src/types/・外部npm
src/types/   →  依存なし（末端）
```

**禁止される依存**:
- `src/repositories/` → `src/services/` ❌
- `src/services/` → `app/` ❌
- `src/services/` → `components/` ❌
- `src/lib/` → `src/services/` ❌（循環防止）
- クライアントコンポーネント → `src/repositories/` ❌（APIを経由すること）

### パスエイリアス（`tsconfig.json`）

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- `@/src/services/image-service` のように絶対パスで import する
- 相対パス `../../` の多用を禁止

**主な参照パターン**:

```typescript
// app/api/* から service / lib を参照
import { imageService } from '@/src/services/image-service';
import { createClient } from '@/src/lib/supabase/server';

// app/(site)/* から components / types を参照
import { ImageCard } from '@/components/image-card';
import type { LgtmImage } from '@/src/types/image';

// components/ から lib（クライアント専用）を参照
import { createClient } from '@/src/lib/supabase/client';

// service / repository から types / lib を参照
import type { Database } from '@/src/types/database.types';
import { DuplicateImageError } from '@/src/lib/errors';
```

---

## P1フェーズで追加予定のファイル

PRD で P1 と定義された機能（管理者削除・通報・物理クリーンアップ・ファイルアップロード）に必要なファイルを以下に列挙する。MVP のツリーには含めず、P1 着手時に本リストに従って配置する。

### 機能6: 管理者による画像削除（操作ログ）

```
src/repositories/admin-log-repository.ts        # 管理者操作ログ CRUD
src/services/admin-service.ts                   # 管理者削除フロー（論理削除+即時Blob物理削除）
src/lib/validation/admin.ts                     # 管理者操作APIのzodスキーマ
app/api/admin/images/[id]/route.ts              # 管理者削除専用エンドポイント
supabase/migrations/*_create_admin_logs.sql     # 管理者操作ログテーブル
tests/unit/services/admin-service.test.ts
tests/integration/admin/admin-delete.test.ts
```

### 機能7: ユーザー通報機能

```
src/types/report.ts                             # ImageReport インターフェース
src/repositories/report-repository.ts           # 通報CRUD・閾値判定クエリ
src/services/report-service.ts                  # 通報追加・5件超過時の自動非表示
src/lib/validation/report.ts                    # 通報APIのzodスキーマ
app/api/reports/route.ts                        # POST（通報送信）
supabase/migrations/*_create_image_reports.sql  # image_reports テーブル
tests/unit/services/report-service.test.ts
tests/integration/reports/report-flow.test.ts
```

### 機能8: 削除画像の物理クリーンアップ

```
src/services/cleanup-service.ts                 # deleted_at から30日経過した画像のBlob/DB削除
.github/workflows/cleanup.yml                   # 日次クリーンアップジョブ
tests/unit/services/cleanup-service.test.ts
```

### 機能9: ファイルアップロード対応

```
src/lib/image/validate-upload.ts                # アップロードファイルのMIME/サイズ検証
# 既存の components/image-register-form.tsx にドラッグ&ドロップ + ファイル選択UIを追加
#   （URL入力とファイルアップロードの導線を1つのフォームに統合する。新規ファイルは作らない）
# 既存の app/api/images/route.ts を multipart/form-data 対応に拡張
# 既存の src/services/image-service.ts に createImageFromUpload() を追加
tests/unit/lib/image/validate-upload.test.ts
tests/e2e/image-upload.test.ts
```

> P1 着手時にこのリストを参照しつつ、不要になったファイルや追加が必要なファイルを順次更新する。
> 上記の配置先は MVP の命名規則・依存ルール（本ドキュメント前段で定義済み）に従う。

---

## スケーリング戦略

### 機能の追加方針

| 規模 | 対応 |
|------|------|
| 小規模（1-2ファイル） | 既存ディレクトリに追加 |
| 中規模（3-10ファイル） | `src/services/` 内にサブディレクトリを作成 |
| 大規模（機能独立性が高い） | `src/modules/{機能名}/` として分離を検討 |

### ファイルサイズの管理

- 1ファイル 300行以下を目安
- 300行超: リファクタリングを検討
- 500行超: 分割を強く推奨

---

## 除外設定

### `.gitignore`

Node.js 標準テンプレートをベースに、本プロジェクト固有の除外を末尾に追加している。主な固有分は以下。

```
# dotenv environment variable files
.env
.env.*
!.env.example

# Playwright
playwright-report/
test-results/
tests/e2e/.auth/

# Supabase
supabase/.temp/
supabase/.branches/
supabase/snippets/

# Generated database types（コミット対象だが、再生成中の中間状態は無視）
src/types/database.types.ts.tmp

# プレビュースクリプト等の作業用出力
tmp/

# Vercel のプロジェクトにリンクされた際に作成されるディレクトリ
.vercel
```

`node_modules/` `.next` `coverage` `*.tsbuildinfo` 等の一般的な除外はテンプレート由来。正典は `.gitignore` 本体とする。

### Biome の除外設定

`biome.json` の `files.includes` (negation パターン) で指定する。

```json
{
  "files": {
    "includes": [
      "**",
      "!**/node_modules/",
      "!**/.next/",
      "!supabase/migrations/",
      "!**/coverage/",
      "!**/playwright-report/",
      "!**/test-results/",
      "!**/.claude/worktrees",
      "!src/types/database.types.ts",
      "!next-env.d.ts"
    ]
  }
}
```
