# 要求: 画像一覧画面

## 対応する PRD 機能

- [PRD P0 #5 画像一覧画面](../../docs/product-requirements.md#5-画像一覧画面)
- [機能設計書: 画像一覧取得 / UI 設計 > 画像一覧画面](../../docs/functional-design.md#画像一覧取得)

## 今回の実装スコープ

「ログインなしでも閲覧できる」画像一覧画面の MVP 実装一式。

- `GET /api/images` エンドポイント (カーソルページネーション)
- トップページ (`app/(site)/page.tsx`) を画像一覧 UI に置き換え
- 画像カード / グリッド / マークダウンコピーボタンの再利用可能コンポーネント化
- 「もっと読み込む」ボタンによる追加ページ取得 (Client Component)

## 受け入れ条件

### API 要件 (`GET /api/images`)

- [ ] 既存 `app/api/images/route.ts` に `GET` を追加 (`POST` と同居)
- [ ] クエリ: `cursor` (`createdAt` ISO 文字列, 任意) / `limit` (デフォルト 20, 最大 50)
- [ ] レスポンス: `{ images: [{ id, imageUrl, uploaderId, createdAt }], nextCursor }`
- [ ] `status = 'active'` のみ返す。論理削除済みは含めない
- [ ] 並び順は `createdAt DESC` (新着順)
- [ ] 認証不要 (ログインなしでも 200)
- [ ] `limit` が 1〜50 の範囲外、または `cursor` が ISO 8601 として不正なら 400 で日本語メッセージを返す
- [ ] 公開フィールドは `id` / `imageUrl` / `uploaderId` / `createdAt` のみ。`pHash` / `originalUrl` / `width` / `height` / `fileSizeBytes` / `mimeType` / `status` / `deletedAt` / `updatedAt` は返さない

### UI 要件 (画像一覧画面)

- [ ] トップページ (`/`) で初期 20 件を Server Component で取得し描画する
- [ ] レスポンシブグリッド: PC (1280px〜) 4 カラム / タブレット (768px〜) 3 カラム / モバイル 2 カラム
- [ ] 各カードに LGTM 合成済み画像 (`object-cover`) とマークダウンコピーボタンを配置
- [ ] マークダウンフォーマットは `![LGTM](<imageUrl>)`
- [ ] マークダウンコピーは Client Component。`navigator.clipboard.writeText()` で書き込み、成功時は「コピーしました ✓」を 2 秒間表示してから元に戻す
- [ ] `nextCursor` がある場合は「もっと読み込む」ボタンを表示し、クリックで `GET /api/images?cursor=...` を呼び結果を末尾に追記する
- [ ] 1 件もない場合は「まだ画像がありません」など empty state を表示する (ログイン誘導は維持)
- [ ] 未ログインの導線 (PRD 受け入れ条件) は壊さない: 既存の「画像の閲覧とマークダウンのコピーはログイン不要」「ログインして登録」ボタンの文言は適切に再配置する

### 非機能 / パフォーマンス

- [ ] LCP 3 秒以内を満たすため、初期描画は Server Component + Next.js `<Image>` (Vercel Blob remote pattern は既存 `next.config.ts` で許可済み)
- [ ] 画像は `loading="lazy"` (Next.js `<Image>` のデフォルト) を活用
- [ ] 50 件以上のデータがあっても破綻しないこと (カーソル追加読みで対応)

### バリデーション / セキュリティ

- [ ] zod で `cursor` (ISO 8601) と `limit` (1〜50 の整数) を検証
- [ ] 認証チェックは行わない (匿名 SELECT は RLS `anyone can view active images` で許可済み)
- [ ] `imageUrl` のレンダリングは React 標準のエスケープに任せ、外部スクリプト埋め込みの余地を作らない

### コード品質

- [ ] `src/services/**` 90% / `src/lib/**` 80% のカバレッジ閾値を維持
- [ ] `as` キャストはガイドライン例外以外で使用しない
- [ ] `npm run lint` / `npm run typecheck` / `npm test` がエラーなく通る
- [ ] implementation-validator の検証をパスする

### テスト

- [ ] `tests/unit/lib/validation/image.test.ts` に `listImagesQuerySchema` のテストを追加 (cursor / limit / 境界値)
- [ ] `tests/unit/repositories/image-repository.test.ts` に `list` メソッドのテストを追加 (cursor 有無 / 空 / 件数 / DB エラー)
- [ ] `tests/unit/services/image-service.test.ts` に `listImages` のテストを追加 (cursor 渡し / nextCursor 計算 / limit デフォルト)
- [ ] E2E (`tests/e2e/image-list.test.ts`) を追加: 未ログインで `/` にアクセスし、ヘッダー / コピーボタン or empty state が表示されることを最小限検証 (Supabase Local 不要範囲で実装)

## 今回スコープ外 (意図的に除外)

- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) — 別 PR
- お気に入り機能 (PRD #4-A / #4-B) — 別 PR (お気に入りボタンも今回は出さない)
- 画像登録フォーム UI / `app/(site)/images/new/page.tsx` — 別 PR
- 画像削除 (PRD #2) / 管理者削除 (PRD #6) — 別 PR
- `Cache-Control: s-maxage=60, stale-while-revalidate=300` の付与 — 計測指標の整備と合わせて別タスクで検討
- Markdown コピー時のカスタムイベント発火 (`markdown_copied`, KPI 計測用) — Vercel Analytics 設定後に別 PR
- 統合テスト (Supabase Local が必要) — 整備後に別 PR

## 前提・制約

- 既存 `lgtm_images` テーブル / RLS は本タスクで作らない (画像登録 API で作成済み)
- `database.types.ts` は手書き運用継続。`lgtm_images` の Row 型は変更不要
- `next.config.ts` の Vercel Blob remote pattern (`*.public.blob.vercel-storage.com`) は既存設定を流用
- カーソル方式: 「`createdAt` の ISO 文字列 (UTC, ms 精度)」で前ページ末尾を表現する。同一 `createdAt` の重複は MVP では考慮しない (UUID v7 などへ移行する場合は別 PR)
