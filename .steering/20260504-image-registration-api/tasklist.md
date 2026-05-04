# タスクリスト: 画像登録 API

## Phase 1: DB スキーマ・型

- [x] T1-1 `supabase/migrations/20260504000000_create_lgtm_images.sql` を作成 (テーブル / インデックス / set_updated_at トリガ / RLS)
- [x] T1-2 `supabase/migrations/20260504000001_create_daily_upload_counts.sql` を作成 (テーブル / RLS / `increment_daily_upload_count` RPC 関数)
- [x] T1-3 `src/types/image.ts` に `LgtmImage` インターフェースと `ImageStatus` 型を定義
- [x] T1-4 `src/types/database.types.ts` に `lgtm_images` / `daily_upload_counts` の Row/Insert/Update と RPC `increment_daily_upload_count` の型を追記

## Phase 2: 共通ユーティリティ

- [x] T2-1 `src/lib/validation/image.ts` を作成 (zod `createImageRequestSchema`)
- [x] T2-2 `src/lib/http/safe-fetch.ts` を作成 (HTTPS 限定 / プライベート IP 拒否 / Content-Type / サイズ上限 / redirect 禁止)
- [x] T2-3 `src/lib/image/validate-image.ts` を作成 (Sharp metadata で JPEG/PNG/GIF 検証・アニメ GIF 拒否)
- [x] T2-4 `src/lib/image/calculate-phash.ts` を作成 (`calculatePHash` / `hammingDistance` / `isDuplicate` / `DUPLICATE_THRESHOLD`)
- [x] T2-5 `src/lib/image/compose-lgtm.ts` を作成 (`composeLgtmImage` / `MAX_OUTPUT_WIDTH`)

## Phase 3: Repository 層

- [x] T3-1 `src/repositories/image-repository.ts` を作成 (`create` / `listActivePHashes`、Supabase Client ジェネリクス指定)
- [x] T3-2 `src/repositories/daily-upload-count-repository.ts` を作成 (`getCount` / `increment` を RPC 経由)

## Phase 4: Service 層

- [x] T4-1 `src/services/image-service.ts` を作成 (`ImageService` クラス・`buildImageService` ファクトリ・`MAX_DAILY_UPLOADS` 定数)
- [x] T4-2 Blob クライアント抽象を service ファイル内で型定義し、DI 可能にする (本番は `@vercel/blob` の `put` / `del` をラップ)

## Phase 5: API Layer

- [x] T5-1 `app/api/images/route.ts` を作成 (POST のみ / 認証 / zod / エラー → HTTP 変換 / `existingImageId` 返却)
- [x] T5-2 `app/api/images/.gitkeep` を削除

## Phase 6: ユニットテスト

- [x] T6-1 `tests/unit/lib/validation/image.test.ts` (URL 検証境界)
- [x] T6-2 `tests/unit/lib/http/safe-fetch.test.ts` (HTTPS 限定 / プライベート IP / サイズ超過 / Content-Type)
- [x] T6-3 `tests/unit/lib/image/validate-image.test.ts` (JPEG/PNG/GIF/アニメ GIF/SVG)
- [x] T6-4 `tests/unit/lib/image/calculate-phash.test.ts` (同一性 / 距離 / 閾値)
- [x] T6-5 `tests/unit/lib/image/compose-lgtm.test.ts` (WebP 出力 / 幅 1200px / メタデータ)
- [x] T6-6 `tests/unit/repositories/image-repository.test.ts` (create / listActivePHashes / DB エラー)
- [x] T6-7 `tests/unit/repositories/daily-upload-count-repository.test.ts` (getCount / increment / DB エラー)
- [x] T6-8 `tests/unit/services/image-service.test.ts` (上限超過 / 重複 / 正常系 / Blob ロールバック)

## Phase 7: 検証

- [x] T7-1 implementation-validator サブエージェントで全実装を検証し、指摘を解消
- [x] T7-2 `npm run lint` がエラーなしで通る
- [x] T7-3 `npm run typecheck` がエラーなしで通る
- [x] T7-4 `npm test` が全件 pass する (81 tests / 11 files、coverage threshold もクリア)

## Phase 8: 振り返り

- [x] T8-1 本ファイル末尾に「申し送り事項」を追記 (実装日 / 計画と実績の差分 / 学んだこと / 次回への改善提案)

---

## 申し送り事項

### 実装完了日
2026-05-04

### 実装サマリー

`POST /api/images` (画像登録 API) を、機能設計書の処理フローに沿って実装した。

- マイグレーション 2 件 (`lgtm_images` / `daily_upload_counts`) と RPC `increment_daily_upload_count`
- レイヤード実装: `app/api/images/route.ts` → `src/services/image-service.ts` → `src/repositories/{image,daily-upload-count}-repository.ts`
- 共通ユーティリティ: `src/lib/http/safe-fetch.ts` (SSRF) / `src/lib/image/{calculate-phash,compose-lgtm,validate-image}.ts` / `src/lib/validation/image.ts` (zod)
- ユニットテスト 11 ファイル / 81 ケース・全パス
- カバレッジ: `src/services/**` 100% (statements/functions/lines), `src/lib/**` 平均 92%+

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| 上限チェックと increment の atomicity | 「先勝ちで 10 件目はギリで通す/超過時の二重通知は許容」と design.md で明記 | implementation-validator の指摘 (Problem 3) を受け、RPC に `count < p_max` の check を組み込み atomic 化。`P0001` raise を repository で `DailyLimitExceededError` に変換 |
| Service の処理順序 | DB create → increment → 失敗時 Blob ロールバック | 「create 成功・increment 失敗で孤児 DB レコードが残る」(Problem 1) を解消するため、`increment → blob.put → imageRepo.create` の順に変更。DB write を最後に置くことで、構造的に "Blob 不在の active 行" を作らない |
| pHash 重複チェックの対象 | 当初 `status='active'` のみで合意 (今回スコープ) | implementation-validator 指摘 (Problem 2) について検討し、UX 上「論理削除済み画像との重複は再登録可能とする」方が自然と判断。`image-repository.ts` / `image-service.ts` に方針コメントを追記 |
| アニメーション GIF 検出のテスト | 実 sharp + 埋め込みバイナリで検証 | 最小アニメ GIF のバイト列を sharp が parse 失敗するため、`assertSupportedImageMetadata(metadata)` を純粋関数として抽出し metadata 直接渡しでテストする方針に変更 |
| `database.types.ts` | 自動生成方針 | Supabase Local が起動していないため、user_profiles と同じく手書き。RPC `increment_daily_upload_count` は `Args: { p_user_id, p_date, p_max? }` で `p_max` をオプショナルに |
| Default Blob クライアントのテスト | 統合テストで担保するつもりだった | カバレッジ閾値 (functions 90%) を確実にクリアするため、`vi.mock('@vercel/blob')` で `put`/`del` の委譲をユニットテストでも検証 |
| ユニットテスト件数 | 計画約 50 件想定 | 実績 81 件 (errors 既存 10 + auth 既存 5 + repository 既存 5 + 今回追加 61) |

### 学んだこと

1. **Postgres `INSERT ... ON CONFLICT DO UPDATE ... WHERE` の挙動**: `ON CONFLICT DO UPDATE SET ... WHERE` の WHERE 節は UPDATE 対象行に対する条件で、評価が false のとき UPDATE はスキップされて RETURNING も空になる。これを利用して「上限内のときだけ +1」を 1 ステートメントで atomic に実装できる。`v_new_count IS NULL` で上限超過を判定し `RAISE EXCEPTION ... USING ERRCODE = 'P0001'` で発火する。
2. **Supabase JS の RPC エラー判別**: `raise exception 'msg' using errcode = 'P0001'` は client 側で `error.code === 'P0001'` && `error.message === 'msg'` として届く。同じ `P0001` でも文字列で分岐することで誤判定を避けられる。
3. **データ整合性の "順序設計"**: 複数の I/O (Blob・DB・カウンタ) を跨ぐ書き込み順を「最後に DB 書き込み」にすると、catch 内のロールバックが Blob だけで済み、孤児 DB レコードを構造的に排除できる。トランザクションが張れない異種バックエンド間で有効な原則。
4. **Sharp のテスト容易性**: 実画像が必要なケース (PNG/JPEG/WebP/static GIF) と、metadata だけで分岐する純粋ロジック (animated GIF / format reject) を分離し、後者を独立関数 (`assertSupportedImageMetadata`) として抽出することで、難しいバイナリ生成を回避しつつ高カバレッジを保てる。
5. **Vercel Blob v2 の `put` シグネチャ**: `optionsInput: PutCommandOptions` が **必須** (`access` が必須プロパティ)。v0.x の `await put(path, body)` のシグネチャはもう通らない。`{ access: 'public', contentType: 'image/webp' }` を明示する。
6. **vi.mock + 名前付き import + overload 関数の型衝突**: `node:dns/promises` の `lookup` は overload で戻り値が変わるため、`vi.mocked(lookup).mockResolvedValue([{...}])` が Type 'LookupAddress[]' is not assignable to ... と弾かれる。`as unknown as Mock` で 1 回キャストすれば回避できる (テストコードのみの例外として許容)。
7. **TypeScript 6.x + zod 4.x の `z.string().url()`**: development-guidelines.md は v4 互換のサンプルになっており、`z.string().url().startsWith('https://').max(2048)` で問題なく動く。v5 でドロップ予定の `z.url()` への移行は次回以降。
8. **DNS rebinding はアプリレイヤーで完全には防げない**: SSRF 対策として「DNS lookup → private IP 拒否 → fetch」の 3 段は実装できるが、lookup と fetch の間に DNS が書き換わる攻撃 (rebinding) はサーバー側コードでは封じきれない。実行環境 (Vercel Functions) の特性で許容範囲と判断したことをコメントに明記して認識を残す。

### 次回への改善提案

1. **Supabase Local を起動して `npm run db:types` を実行する**
   - 現在 `database.types.ts` は手書きで、`lgtm_images` / `daily_upload_counts` / RPC の型を維持している
   - Supabase Local + Docker が動かせる環境では `npm run db:start` → `npm run db:reset` → `npm run db:types` で再生成し、手書きとの diff を最小化する習慣をつける

2. **統合テスト基盤の整備**
   - 今回 unit のみ。Supabase Local + 実 Postgres での RLS 検証 (`tests/integration/images/`) を次の `/add-feature` で着手する
   - `app/api/images/route.ts` の認証チェック・zod 検証・409/429 への変換は、unit ではモックでしかテストしていない

3. **重複検出スコープの最終決定**
   - 現在は `status='active'` のみ対象。論理削除済み画像との重複を許容しているのが UX 的に妥当か、PRD に追記して合意する
   - 全件対象にする場合は `existingImageId` が deleted を指したときの 409 レスポンスでフロント側に「再登録可能 / 既存ページに飛ばさない」フォールバックを実装する必要がある

4. **`status='processing'` の活用方針**
   - 現実装では `processing` を経由せず `active` で直接 insert している (機能設計書のシーケンス図と一致)
   - 「DB レコード先行作成 + 後段の合成・Blob 保存」のパターンに乗り換える場合 (例: 非同期キューイング)、`processing` 状態が活きる。そのときに `lgtm_images` の RLS や一覧 API のフィルタを再点検する

5. **画像登録フロント (UI) の実装**
   - `components/image-register-form.tsx` と `app/(site)/images/new/page.tsx` で API を呼ぶ Client Component を作る
   - 409 → 既存画像詳細へのリダイレクト・429 → ユーザー向けメッセージ・400 → エラーメッセージ表示
   - `useFormStatus` で処理中インジケータ、完了後トースト

6. **`compose-lgtm.ts` のフォント可搬性**
   - 現状 SVG の `font-family="Arial Black, sans-serif"` に依存しており、Vercel Functions の Linux 環境にこのフォントが無いと描画が崩れる
   - 自前フォント (例: Noto Sans JP の Bold) を `public/fonts/` に置き、`<defs><style>@font-face</style></defs>` で SVG にインライン埋め込みする方が安定

7. **ファイルアップロード (PRD P1 #9) との合流ポイント**
   - 今回の `validateImage` / `composeLgtmImage` / `calculatePHash` / `ImageRepository` は file upload でも完全に再利用可能
   - URL 取得の代わりに `multipart/form-data` のバイナリを直接渡す入口を `image-service.ts` に追加すれば、その他のロジックは無改修で良い

### 今回スコープ外として残したもの

- `GET /api/images` (画像一覧取得) — 一覧画面実装時に同ファイルへ追加
- `DELETE /api/images/:id` (画像削除) — PRD #2 として別 PR
- お気に入り機能 (PRD #4-A / #4-B) — 別 PR
- 画像登録フォーム UI / 画像詳細ページ — 別 PR
- 統合テスト (`tests/integration/`) / E2E (`tests/e2e/`) — フロント実装と合わせて別 PR
- 管理者削除 (PRD #6) / 通報 (PRD #7) / 物理クリーンアップ (PRD #8) — P1 フェーズ
- ファイルアップロード (PRD #9) — P1 フェーズ

