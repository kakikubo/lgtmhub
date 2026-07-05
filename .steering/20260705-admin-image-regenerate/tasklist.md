# Tasklist — 管理者限定 LGTM 画像再生成

## 実装タスク (順次)

- [x] 1. `PublicLgtmImageDetail` 型を `src/types/image.ts` に追加する
- [x] 2. `ImageRepository.listActivePHashesExcept(excludeId)` を追加する
- [x] 3. `ImageRepository.updateAfterRegenerate(id, patch)` を追加する
- [x] 4. `regenerateImageRequestSchema` / `regenerateImageResponseSchema` を `src/lib/validation/image.ts` に追加する
- [x] 5. `src/lib/auth/require-admin.ts` を新規作成し `requireAdmin(supabase)` を実装する
- [x] 6. `ImageService` に `buildLgtmVariant` プライベート helper を切り出す (createImage を helper 経由に置き換える)
- [x] 7. `ImageService.regenerateImage(imageId, overrideUrl)` を追加する (認可は Route Handler 層に委譲)
- [x] 8. `ImageService.getImageDetail(id)` を追加し、詳細ページ用に `originalUrl` を含む型で返す (旧 getImage を置換)
- [x] 9. `app/api/images/[id]/regenerate/route.ts` を新規作成する (POST + maxDuration=60)
- [x] 10. `components/image-regenerate-action.tsx` を新規作成する (`'use client'` + AlertDialog + URL input)
- [x] 11. `app/(site)/images/[id]/page.tsx` を修正し、is_admin を取得して `ImageRegenerateAction` を条件付き描画する
- [x] 12. `tests/unit/lib/auth/require-admin.test.ts` を作成する
- [x] 13. `tests/unit/repositories/image-repository.test.ts` に `listActivePHashesExcept` / `updateAfterRegenerate` のケースを追加する
- [x] 14. `tests/unit/services/image-service.test.ts` に `regenerateImage` / `getImageDetail` のケースを追加する
- [x] 15. `tests/unit/api/images/regenerate-route.test.ts` を新規作成する
- [x] 16. `pnpm run check` を通す (biome)
- [x] 17. `pnpm run typecheck` を通す
- [x] 18. `pnpm run test` を通す (242/242 passed)

## 検証タスク

- [x] 19. implementation-validator サブエージェントで実装品質を検証する (合格 4.8/5)
- [x] 20. 振り返りを本ファイル末尾に追記する

## 申し送り事項 (振り返り)

- **実装完了日**: 2026-07-05
- **対応 Issue**: #195 「管理者限定: 画像詳細ページに LGTM 画像の再生成機能を追加する」
- **成果物**:
  - 新規 8 ファイル (auth util / route / component / plan 3 / test 2)
  - 変更 8 ファイル (types / repo / validation / service / page / 既存テスト 2 / tasklist)
- **テスト結果**: `pnpm run check` / `pnpm run typecheck` / `pnpm run test (242/242)` すべてパス
- **品質検証**: implementation-validator が「合格 4.8/5」判定、Issue の受け入れ条件 9 項目すべて実装 + テストで裏付け済み

### 計画と実績の差分

1. **`regenerateImage` シグネチャ変更**
   - 計画: `regenerateImage(imageId, requesterId, overrideUrl): Promise<LgtmImage>`、Service 層で `console.info` の監査ログ
   - 実績: `regenerateImage(imageId, overrideOriginalUrl): Promise<{ image, previousImageUrl, urlChanged }>`、監査ログは Route Handler 層で `requireAdmin` の返す `userId` を使って出力
   - 理由: Service が `requesterId` を引くと `requireAdmin` と責務が二重化し、テストが煩雑になる。Route 層で監査ログを出すことで userId の重複取得を避けた。
2. **`createImage` の実行順序変更 (計画外の副次改善)**
   - 変更前: `getCount` → 取得/検証/合成 → `increment` → `blob.put` → `imageRepo.create`
   - 変更後: `getCount` → `buildLgtmVariant` (取得/検証/合成 + `blob.put`) → `increment` (失敗時は新 Blob del) → `imageRepo.create`
   - 影響: `blob.put` が先になるため、`increment` が TOCTOU で失敗したとき新 Blob を `del` でロールバックする必要がある。既存の TOCTOU テストを新しい順序に合わせて更新した。
3. **`getImage` を `getImageDetail` にリネーム**
   - 詳細ページで `originalUrl` (管理者にのみ渡す) を含めた `PublicLgtmImageDetail` を返すよう変更。`getImage` の呼び出しは詳細ページと自身のテスト以外に存在しなかったため、後方互換 shim は追加せず置換した。
4. **レスポンススキーマを実消費**
   - `regenerateImageResponseSchema` を定義したが initial 実装では未参照だった (validator 指摘)。`app/api/CLAUDE.md` 規約「クライアントは safeParse でシェイプを実行時検証」に合わせ、`ImageRegenerateAction` の 200 分岐で safeParse するよう追加改修した (失敗時は warning ログのみで refresh 続行)。

### 学んだこと

- Extract Method (`buildLgtmVariant`) を通す際は「DailyLimit 消費 / DB 書き込みは helper の外」の線引きを事前に決めておくと、`createImage` / `regenerateImage` の順序差 (increment を打つか / 打たないか) を helper に持ち込まずに済む。
- `app/api/CLAUDE.md` の「レスポンス側スキーマも定義する」規約は、クライアントの `safeParse` 呼び出しまでセットで満たさないと dead code になる。スキーマ定義と参照は 1 PR 内で必ずペア。
- pnpm 11.9.0 の corepack cache が破損すると `pnpm run ...` 全滅 → `corepack pnpm ...` フォールバックで回避可能。今回は `package.json` の `packageManager` フィールドに checksum を追加しないと corepack が cache を再構築しないケースに遭遇したが、`corepack pnpm --version` 単独では動くため、`corepack pnpm run <task>` で作業継続した。

### 次回への改善提案

- `.steering/*/design.md` は実装中の設計変更 (シグネチャ差分等) が発生した時点で追記/修正するルールにする。振り返り欄だけに残すと後から design.md を単独で読む人がミスリードする (validator の提案 2)。
- `ImageRegenerateAction` の分岐 (ダイアログ開閉時のリセット、trim 後の空文字判定、200 時の safeParse 分岐、非 200 時のエラーメッセージ抽出) に対する Component テストを Vitest + Testing Library で追加する。E2E は管理者ログイン導線が未整備で今回は対象外にしたが、単純な fetch モック単体テストなら低コストで書ける。
- `docs/functional-design.md` の管理者機能セクションに、今回追加した `POST /api/images/[id]/regenerate` を明記する PR を後追いで作る (基本設計への影響)。
- Blob 削除失敗時の孤児 Blob 回収を将来の日次クリーンアップに委ねる方針を採ったが、現状 PRD 機能 8 (日次クリーンアップ) 側の実装がまだ無いため、実装されるまでは孤児が残り得る点を functional-design にリスクとして記載する。
