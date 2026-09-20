# 設計書

## アーキテクチャ概要

キャッシュ境界は ImageService を呼び出すため Service 層に置く。lib は services を知らない、という単方向を復元する。

```
app/ / components/HomeContent (RSC)
        ↓
src/services/cache/list-home-images.ts   ← 'use cache' + cacheTag
        ↓
src/services/image-service.ts
        ↓
src/repositories/ / src/lib/
```

案B（lib の cache を例外として許容）は採らない。構造をシンプルに保つため、依存方向を規約に合わせる。

## コンポーネント設計

### 1. `src/services/cache/list-home-images.ts`

**責務**:
- トップページ初期表示用の画像一覧（cursor 無し / デフォルト limit）をタグ付きでキャッシュする
- 投稿 / 削除 / 再生成成功時の `revalidateTag(HOME_IMAGES_CACHE_TAG, 'max')` が参照するタグ定数を提供する

**実装の要点**:
- ファイル内容は現行 `src/lib/cache/list-home-images.ts` を維持する（ロジック変更なし）
- `'use cache'` 配下では `cookies()` が呼べないため `createAnonClient` を使う
- `cacheLife('max')`、無効化は `revalidateTag` の明示呼び出しに委ねる
- `src/services/` 直下の `*-service.ts` とは責務が違う（`'use cache'` / `next/cache`）ため、`cache/` サブディレクトリに隔離する

### 2. 参照の張り替え

**責務**:
- 公開 API の import パスだけを更新する

**実装の要点**:
- `@/src/lib/cache/list-home-images` → `@/src/services/cache/list-home-images`
- 対象: `components/home-content.tsx`、`app/api/images/route.ts`、`app/api/images/[id]/route.ts`、`app/api/images/[id]/regenerate/route.ts`、関連ユニットテスト

### 3. `HomeContent` の依存例外

**責務**:
- Suspense 境界としてデータ取得を担う Server Component

**実装の要点**:
- ページを同期 RSC のまま静的シェルにするため、取得処理は `HomeContent` 内に残す（`app/(site)/page.tsx` へ引き上げない）
- `components/` のクライアントコンポーネントが `src/services/` を import する禁止は維持する
- Server Component に限り `src/services/cache/` を許可する、と repository-structure に書く

## データフロー

### トップページ初期一覧
```
1. HomeContent が getHomeImagesInitial() を呼ぶ
2. 'use cache' 関数が cacheTag / cacheLife を設定する
3. createAnonClient() で anon クライアントを作り、buildImageService(supabase).listImages() する
4. 投稿・削除・再生成の Route Handler が revalidateTag(HOME_IMAGES_CACHE_TAG, 'max') で破棄する
```

## エラーハンドリング戦略

変更しない。`HomeContent` の `.catch` による graceful degrade、Route Handler の既存エラー変換はそのまま。

## テスト戦略

### ユニットテスト
- 新規: `tests/unit/services/cache/list-home-images.test.ts`
  - anon client で `listImages` を呼ぶこと
  - `cacheTag(HOME_IMAGES_CACHE_TAG)` と `cacheLife('max')` を呼ぶこと
- 既存の route / HomeContent テストは import パスと `vi.mock` パスを更新する
- `next/cache` モックに `cacheTag` / `cacheLife` を足し、モジュール読み込み時に欠けないようにする

### 統合テスト
- 追加しない（キャッシュ無効化の契約は既存 route テストで担保）

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
src/services/
├── image-service.ts
├── favorite-service.ts
├── user-profile-service.ts
└── cache/
    └── list-home-images.ts   # 移動先

src/lib/cache/                # 削除
```

## 実装の順序

1. ファイルを `src/services/cache/` へ移動する
2. 本番コードとテストの import / mock を更新する
3. ユニットテストを追加する
4. ドキュメントと CLAUDE.md を更新する
5. `pnpm run check` / `typecheck` / `test` を通す

## セキュリティ考慮事項

- anon ロール + RLS `"anyone can view active images"` の前提は変えない
- Cookie 連携クライアントを `'use cache'` 内で使わない制約は変えない

## パフォーマンス考慮事項

- キャッシュ寿命・タグ・無効化タイミングは現行どおり。ヒット率や TTFB を変える変更ではない

## 将来の拡張性

- 同様の `'use cache'` 境界が増えたら `src/services/cache/` に並べる
- lib にキャッシュヘルパーを置く場合は services を import しない純関数に限る
