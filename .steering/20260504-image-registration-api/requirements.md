# 要求: 画像登録 API

## 対応する PRD 機能

- [PRD P0 #1 画像登録機能](../../docs/product-requirements.md#1-画像登録機能)
- [機能設計書: 画像登録 API](../../docs/functional-design.md#画像登録)

## 今回の実装スコープ

`POST /api/images` エンドポイントとそれを支えるレイヤード実装一式。
URL を受け取り、画像をダウンロード→検証→重複チェック→LGTM 文字合成→Vercel Blob 保存→DB 登録までを完了させる。

## 受け入れ条件

### API 要件

- [ ] `POST /api/images` を実装し、認証済みユーザーのみが利用できる
- [ ] リクエスト形式: `{ imageUrl: string }`(HTTPS の URL のみ・最大 2048 文字)
- [ ] 成功時は `201 Created` で `{ id, imageUrl }` を返す
- [ ] 画像取得・合成・保存・DB 登録を 10 秒以内に完了させる(Vercel Function タイムアウト内)

### バリデーション

- [ ] zod でリクエストボディを検証(URL 形式・HTTPS 限定・長さ制限)
- [ ] SSRF 対策: プライベート IP / リンクローカル / loopback への取得を拒否し、HTTPS 以外のリダイレクトを禁止する
- [ ] 対応フォーマットは JPEG / PNG / GIF(静止画) のみ。サイズ上限 10MB
- [ ] 失敗時は 400 で日本語のエラーメッセージを返す

### ビジネスルール

- [ ] 1 ユーザーあたり 1 日 10 枚まで(超過時は 429・`DailyLimitExceededError`)
- [ ] pHash(32x32 グレースケール平均ハッシュ) でハミング距離 10 以内の既存画像を重複と判定し、409・`existingImageId` を返す
- [ ] 合成出力は WebP・最大幅 1200px・白文字+黒縁の "LGTM" を中央に重ねる
- [ ] DB 登録 (`lgtm_images.status = 'active'`) と `daily_upload_counts` のカウンタ更新を 1 リクエスト内で同期実行する

### データ層

- [ ] `lgtm_images` テーブル (PRD/機能設計書のスキーマ準拠) と RLS ポリシーを追加するマイグレーションを作成
- [ ] `daily_upload_counts` テーブル ((user_id, date) 複合主キー・atomic UPSERT) を追加するマイグレーションを作成
- [ ] `src/types/database.types.ts` を上記スキーマに合わせて更新(自動生成同等の手書き)
- [ ] `src/types/image.ts` に `LgtmImage` / `ImageStatus` を定義

### コード品質

- [ ] `src/lib/`(80%) / `src/services/`(90%) のカバレッジ閾値を維持(vitest.config.ts 参照)
- [ ] `as` キャストはガイドライン例外(Supabase 型由来 / テストモック)以外で利用しない
- [ ] `npm run lint` / `npm run typecheck` / `npm test` がエラーなく通る
- [ ] implementation-validator サブエージェントの検証をパスする

## 今回スコープ外(意図的に除外)

- `GET /api/images`(画像一覧取得): 一覧画面実装時に別 PR
- `DELETE /api/images/:id`(画像削除): PRD #2 として別 PR
- ファイルアップロード対応(PRD P1 #9): 後続フェーズ
- 画像登録フォーム UI / 画像詳細ページ UI: フロントは別 PR
- 統合テスト(Supabase Local 起動が必要): 個別タスクで追加検討
- E2E テスト: フロント実装と合わせて追加

## 前提・制約

- Sharp 0.34 / @vercel/blob v2 / zod v4 / @supabase/ssr v0.10
- Supabase Local が起動できない環境のため、`database.types.ts` は手書きで更新する
  (既存実装と同様、`npm run db:types` で再生成可能な形を保つ)
- Vercel Function メモリ上限 1024MB / タイムアウト 10 秒の制約内で動作させる
