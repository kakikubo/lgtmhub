# 要求内容

## 概要

Vercel Blob にアップロードする LGTM 画像に長期 (1年) の Cache-Control を付与し、ブラウザ・CDN キャッシュを最大限活用して Repeat View の LCP を改善する。

## 背景

`*.public.blob.vercel-storage.com/lgtm/<uuid>.webp` 上の画像は immutable (UUID で一意、書き換わらない) にもかかわらず、現状 `cacheControlMaxAge` を `put()` に明示していないため、`@vercel/blob` SDK のデフォルト (1ヶ月) で配信されている。

`next/image` 最適化レイヤをバイパスしたケース (Issue #61 と組み合わせ) では、Blob の Cache-Control がブラウザ・CDN キャッシュ効率に直結し、LCP に直接影響する。

`docs/architecture.md` のキャッシュ戦略には既に `Cache-Control: public, max-age=31536000, immutable` と方針が定義されているため、コードを設計と整合させる作業でもある。

GitHub Issue: [#62](https://github.com/kakikubo/lgtmhub/issues/62)

## 実装対象の機能

### 1. 新規アップロード時の Cache-Control 拡張

- `src/services/image-service.ts` の `defaultBlobClient.put()` で `@vercel/blob` の `put()` 呼び出し時に `cacheControlMaxAge: 60 * 60 * 24 * 365` (= 1年) を指定する。
- マジックナンバーを避け、`BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` 定数として定義する。
- 既存のユニットテストは `defaultBlobClient` の `put` 引数を `toHaveBeenCalledWith` で検証しているため、テストも同期して更新する。

## 受け入れ条件

### 新規アップロード時の Cache-Control 拡張

- [ ] `defaultBlobClient.put()` が `@vercel/blob` の `put()` を呼び出す際、`cacheControlMaxAge: 31536000` を含むオプションが渡される。
- [ ] 1年を表す秒数が定数 (`BLOB_CACHE_CONTROL_MAX_AGE_SECONDS`) として宣言され、マジックナンバーが残らない。
- [ ] `tests/unit/services/image-service.test.ts` の `default BlobClient (@vercel/blob 委譲)` セクションのアサーションが新しいオプションを含む形で更新され、`npm test` が成功する。
- [ ] `npm run lint` および `npm run typecheck` がエラーなく完了する。

## 成功指標

- 新規アップロード後の Blob レスポンスヘッダで `Cache-Control` の `max-age=31536000` を含む値が返ること (本 PR では設定値の反映までを担保。実環境での curl 検証は本番デプロイ後の運用タスク)。
- `docs/architecture.md` の「キャッシュ戦略」と実装が一致した状態になる。

## スコープ外

以下はこのフェーズでは実装しません:

- **既存画像の Blob メタデータ更新 (再 put バッチ)**: Issue 内でも条件付き (「必要なら」) と書かれており、運用上は新規アップロードから順次置き換えるだけで MVP 規模では十分。実装には全画像の DL→re-put、`allowOverwrite` 制御、エラーハンドリング、RLS 越しの DB 取得などが必要で本タスクとは独立した検討が必要。必要になった時点で別 Issue として切り出す。
- **`Cache-Control` ヘッダの `immutable` ディレクティブ強制**: `@vercel/blob` SDK が `cacheControlMaxAge` 経由で実際にどんなヘッダを返すかは Vercel 側仕様で、SDK では `immutable` を明示指定する API がない。本 PR ではアプリ側で制御可能な `cacheControlMaxAge` のみ設定し、ヘッダ実値は本番デプロイ後に curl で確認する運用タスクとする。
- **`Cache-Control` を返すための独自ルート (例: `/api/images/[id]/raw`) の新設**: 既存方針 (Blob URL を直接配信) を維持。

## 参照ドキュメント

- `docs/architecture.md` - キャッシュ戦略 (line 244 付近)
- `docs/development-guidelines.md` - コーディング規約・テスト戦略
- `docs/functional-design.md` - 画像登録機能のフロー
- GitHub Issue [#62](https://github.com/kakikubo/lgtmhub/issues/62)
