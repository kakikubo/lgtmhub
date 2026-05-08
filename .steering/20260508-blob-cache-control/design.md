# 設計書

## アーキテクチャ概要

Data Layer (`src/services/image-service.ts` 内の `defaultBlobClient`) から `@vercel/blob` の `put()` を呼ぶ際の引数に `cacheControlMaxAge` を追加するだけの局所的な変更。レイヤ構造・依存関係・公開 API は変更しない。

```
ImageService.createImage
   └─ this.blob.put(blobKey, buffer, contentType)   ← BlobClient interface (変更なし)
        └─ defaultBlobClient.put                      ← 内部実装 (ここに cacheControlMaxAge を追加)
             └─ @vercel/blob put(pathname, body, {
                   access: 'public',
                   contentType,
                   cacheControlMaxAge: 31536000  // 新規追加
                })
```

## コンポーネント設計

### 1. `BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` 定数

**責務**:
- Blob 配信時の `cacheControlMaxAge` 値を 1 箇所で定義する。

**実装の要点**:
- ファイル: `src/services/image-service.ts`
- 値: `60 * 60 * 24 * 365` (= 31,536,000 秒 = 1 年)
- `export` するかは利用範囲で決定。今回は同一ファイル内のみで使うため `export` 不要 (ただし将来テスト等から参照する可能性があるなら `export` する)。今回はテスト側でも値を参照するため **`export` する**。

### 2. `defaultBlobClient.put()` の更新

**責務**:
- 既存の `access: 'public'`, `contentType` に加え `cacheControlMaxAge` を `@vercel/blob` の `put()` に渡す。

**実装の要点**:
- `BlobClient` インターフェース (`put(pathname, body, contentType)`) は変更しない。`cacheControlMaxAge` はアプリケーションのポリシー値であり、呼び出し元 (Service) が知る必要はない。
- 変更箇所は `defaultBlobClient.put` の内部実装 1 行のみ。
- DI されたカスタム `BlobClient` (テスト時) には影響を与えない。

### 3. テスト更新

**責務**:
- `default BlobClient (@vercel/blob 委譲)` describe 内のアサーションが新しい `cacheControlMaxAge` を期待するように修正する。

**実装の要点**:
- `tests/unit/services/image-service.test.ts` line 374-378 付近の `expect(blobPut).toHaveBeenCalledWith(..., { access: 'public', contentType: 'image/webp' })` を `{ access: 'public', contentType: 'image/webp', cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE_SECONDS }` (または直接 `31536000`) に書き換える。
- 定数を `import` して使えば値の二重管理を避けられる (推奨)。

## データフロー

### 画像登録 (createImage) 内の Blob put 呼び出し

```
1. ImageService が `this.blob.put(blobKey, buffer, 'image/webp')` を呼ぶ
2. defaultBlobClient.put が起動
3. @vercel/blob の put へ
   { access: 'public', contentType: 'image/webp', cacheControlMaxAge: 31536000 } を渡す
4. Vercel 側で Cache-Control ヘッダ付きで保存される
5. 以後 Blob URL 直アクセス時、レスポンスに長期キャッシュヘッダが付く
```

エラーハンドリング・ロールバック (DB 失敗時の `del()`) には影響なし。

## エラーハンドリング戦略

新規エラーパスはなし。`cacheControlMaxAge` は `@vercel/blob` 側の入力検証 (1 分以上) を満たす値 (1 年) を渡すので、SDK エラーは発生しない想定。

## テスト戦略

### ユニットテスト

- `tests/unit/services/image-service.test.ts` の既存テスト:
  - 「`default BlobClient (@vercel/blob 委譲)` の正常系」: `blobPut` への呼び出し引数に `cacheControlMaxAge` が含まれることを `toHaveBeenCalledWith` で確認。
  - 既存のモック `BlobClient` を使うテスト (DI されたケース) は `BlobClient` インターフェース未変更のためそのまま動作するはず。

### 統合テスト

- 既存の統合テストは Blob モック前提で、Vercel 側ヘッダ実値は検証していないためスコープ外。

### E2E / 手動検証

- 本 PR では静的アサーションのみで担保。本番デプロイ後に Issue 完了条件の curl による Cache-Control 確認を運用タスクとして実施 (本タスクのスコープ外、Issue 内の「計測手順」を参照)。

## 依存ライブラリ

新規追加なし。`@vercel/blob` v2 系は `cacheControlMaxAge` を `put()` のオプションとして受け付け済み (`node_modules/@vercel/blob/dist/index.d.ts` line 359 で確認済)。

## ディレクトリ構造

変更ファイルは 2 ファイルのみ:

```
src/services/image-service.ts             ← 定数追加 + put() オプション追加
tests/unit/services/image-service.test.ts ← アサーション更新
```

## 実装の順序

1. `src/services/image-service.ts` に `BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` 定数を `export` で追加。
2. `defaultBlobClient.put` の `@vercel/blob` `put()` 呼び出しに `cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` を追加。
3. `tests/unit/services/image-service.test.ts` の `default BlobClient (@vercel/blob 委譲)` セクションで定数を `import` し、`toHaveBeenCalledWith` のアサーションを更新。
4. `npm test`, `npm run lint`, `npm run typecheck` を実行してパスを確認。

## セキュリティ考慮事項

- `cacheControlMaxAge` を長期化しても画像の認可モデル (Blob URL は推測困難な UUID で公開) は変わらず、追加の漏洩リスクは生じない。
- 不適切コンテンツの即時排除が必要な場合は管理者削除 (PRD 機能 6) で Blob 物理削除すれば URL 自体が 404 になる、という既存の前提 (`docs/architecture.md` 「論理削除とキャッシュの関係」) を維持。

## パフォーマンス考慮事項

- 1 年キャッシュにより Repeat View では Blob への往復がなくなり、LCP がほぼ 0 に近づく (Issue 完了条件: First View の 50% 以下)。
- 初回アクセス (First View) のパフォーマンスには影響しない。

## 将来の拡張性

- もし将来「画像 URL を変えずに合成内容だけ差し替える」要件が出た場合、`immutable` 前提を覆す可能性がある。その場合は新しい URL に切り替える運用とし、本 PR の前提 (UUID 単位で immutable) を維持する。
- 既存画像への遡及反映が必要になった場合は、別 Issue で `scripts/backfill-blob-cache.ts` 等を新設し、DB 全件取得 → 各 Blob を `allowOverwrite: true` で再 put する運用バッチを設計する。
