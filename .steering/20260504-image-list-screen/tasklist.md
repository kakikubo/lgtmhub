# タスクリスト: 画像一覧画面

## Phase 1: 型・バリデーション

- [x] T1-1 `src/types/image.ts` に `PublicLgtmImage` インターフェースを追加
- [x] T1-2 `src/lib/validation/image.ts` に `listImagesQuerySchema` / `LIST_IMAGES_DEFAULT_LIMIT` / `LIST_IMAGES_MAX_LIMIT` を追加

## Phase 2: Repository 層

- [x] T2-1 `src/repositories/image-repository.ts` に `list({ cursor?, limit })` メソッドを追加 (`status='active'` の `created_at desc` 取得・cursor で `lt`)
- [x] T2-2 ~~既存 `toLgtmImage` をモジュールスコープに昇格させ、`list` でも使い回せるようにする~~ (理由: 既にモジュールスコープに定義されており追加対応不要)

## Phase 3: Service 層

- [x] T3-1 `src/services/image-service.ts` に `listImages({ cursor?, limit? })` を追加 (`PublicLgtmImage[]` と `nextCursor` を返す)
- [x] T3-2 `LgtmImage → PublicLgtmImage` の `toPublic` ヘルパを同ファイル内 (private) に追加

## Phase 4: API Layer

- [x] T4-1 `app/api/images/route.ts` に `GET` ハンドラを追加 (zod 検証 → service 呼び出し → 200 / 400 / 500)
- [x] T4-2 空文字クエリ (`?cursor=`) を undefined 扱いにする入力正規化を `GET` 内で実施

## Phase 5: Presentation Layer

- [x] T5-1 `components/copy-markdown-button.tsx` を新規作成 (Client Component, `navigator.clipboard.writeText`, 2 秒で復帰)
- [x] T5-2 `components/image-card.tsx` を新規作成 (Server Component, `next/image` + コピーボタン)
- [x] T5-3 `components/image-grid.tsx` を新規作成 (Server Component, レスポンシブグリッド, `data-testid="image-grid"`)
- [x] T5-4 `components/load-more-button.tsx` を新規作成 (Client Component, fetch + 追加描画)
- [x] T5-5 `app/(site)/page.tsx` を画像一覧画面に置き換え (Server Component で初期 20 件取得, empty state, ログイン誘導)

## Phase 6: ユニットテスト

- [x] T6-1 `tests/unit/lib/validation/image.test.ts` に `listImagesQuerySchema` のテストを追加 (cursor / limit / 境界値)
- [x] T6-2 `tests/unit/repositories/image-repository.test.ts` に `list` メソッドのテストを追加 (cursor 有無 / 空 / 件数 / DB エラー)
- [x] T6-3 `tests/unit/services/image-service.test.ts` に `listImages` のテストを追加 (デフォルト limit / nextCursor 計算 / cursor 引き渡し)

## Phase 7: E2E テスト

- [x] T7-1 `tests/e2e/image-list.test.ts` を新規作成 (未ログインでトップページに `image-grid` または empty state、ヘッダーが表示される)

## Phase 8: 検証

- [x] T8-1 implementation-validator サブエージェントで全実装を検証し、指摘を解消
- [x] T8-2 `npm run lint` がエラーなしで通る
- [x] T8-3 `npm run typecheck` がエラーなしで通る
- [x] T8-4 `npm test` (vitest) がカバレッジ閾値込みで全件 pass する

## Phase 9: 振り返り

- [x] T9-1 本ファイル末尾に「申し送り事項」を追記 (実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案)
- [x] T9-2 必要に応じて永続ドキュメント (`docs/`) を更新

---

## 申し送り事項

### 実装完了日
2026-05-04

### 実装サマリー

PRD P0 #5「画像一覧画面」を、ログイン不要の閲覧体験まで含めて MVP 実装した。

- **API**: `GET /api/images` をカーソルページネーション (`limit` 1〜50, デフォルト 20 / `cursor` ISO 8601) で実装。`status='active'` のみ・`PublicLgtmImage` の 4 フィールドだけを返す
- **Service**: `ImageService.listImages(params)` を追加。`limit` ちょうどで返ったときだけ末尾要素の `createdAt.toISOString()` を `nextCursor` に設定
- **Repository**: `ImageRepository.list({ cursor?, limit })` を追加 (`status='active'` の `created_at desc` 取得・cursor で `lt`)
- **UI**: トップページ (`/`) を Server Component で初期 20 件描画 → empty state または `ImageGrid` + `LoadMoreButton`
- **コンポーネント**: `ImageGrid` / `ImageCard` / `CopyMarkdownButton` (Client) / `LoadMoreButton` (Client)
- **テスト**: ユニット 24 件追加 (validation 12 / repository 4 / service 5 / response schema 4 / e2e 2)、合計 104 ケース全 pass
- **カバレッジ**: `src/services/**` 100% (>= 90%) / `src/lib/**` 平均 92%+ (>= 80%) で閾値クリア

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| `LoadMoreButton` のグリッド HTML | コンポーネント内で直接組む案だった | implementation-validator 指摘を受けて `ImageGrid` を再利用するよう変更し、グリッドクラスの二重定義を排除。`ImageGrid` に `testId` prop を追加 (デフォルト `image-grid`、追加分は `image-grid-extra`) |
| `LoadMoreButton` のレスポンス処理 | `as RawListResponse` で受ける案だった | implementation-validator 指摘を受けて `listImagesResponseSchema` を `src/lib/validation/image.ts` に追加し、`schema.parse(await res.json())` で runtime バリデーション化。`as` キャストを排除 |
| `CopyMarkdownButton` のフィードバック表示 | ボタンテキストのみ書き換え | `data-testid="copy-feedback"` の `<span>` で包み、`data-copy-state` 属性も追加。`development-guidelines.md` のサンプル E2E と整合 |
| `GET /api/images` の `createClient()` 意図 | コメント無し | 「ログインは不要だが RLS ポリシー (anyone can view active images) を経由するため anon key の Supabase クライアントを生成する」とコメントを追記 |
| `database.types.ts` | 変更なし | 変更不要。今回は新規テーブルなしで完了 |
| E2E テスト | 「データに依存しない範囲でヘッダー / コピーボタン or empty state」を計画 | 同方針で実装。コピー操作の自動検証は `data-testid` を整備したが clipboard API のフレーキー回避のためシナリオ追加は次回送り |

### 学んだこと

1. **Supabase JS のクエリチェイン型**: `from(...).select(...).eq(...).order(...).limit(N)` は最後の `limit(N)` 自体が PromiseLike であり、さらに `.lt(...)` などのフィルタを追加できる「ハイブリッド」な型を返す。テストでは `then` メソッド + `lt` メソッドを併せ持つオブジェクトを作って await・連鎖の両方に対応した
2. **カーソル方式の `nextCursor` 計算**: 「`limit` 件ちょうど返ってきたときだけ次ページがあるとみなす」のが overhead の少ない実装。最終ページで余分なリクエストを発生させない
3. **`PublicLgtmImage` のフィールド絞り込みは Service 層で行う**: Repository は Domain 型を返し、Service が公開用に投影する。pHash や originalUrl などの内部用フィールドが API レイヤーから漏れる事故を構造的に防げる
4. **Next.js App Router での Client / Server 分離**: 一覧の初期 SSR は Server Component で `service.listImages()` 直接呼び (LCP 最短)、追加読み込みは Client Component で `fetch('/api/images?cursor=...')` という二系統が、SEO・LCP・インタラクションを両立させる素直な分け方
5. **`navigator.clipboard.writeText` の失敗処理**: HTTPS でない / ユーザー操作起点でない / Permission denied 等で reject される。catch では state を初期に戻すだけにして、ユーザーが再試行できる UX を維持するのが安全
6. **JSON レスポンスの runtime バリデーション**: `await res.json()` は `any` を返すため、TypeScript の型チェックでは握り潰し放題になる。zod スキーマで `parse()` するか手動の type guard を必ず通すルールを徹底するのが、フロント側の型安全を担保する近道
7. **`z.coerce.number()` の使いどころ**: `URLSearchParams.get()` が string を返す世界では、`z.coerce.number().int()` で「文字列でも数値でも受理する境界変換」を 1 行で書ける。境界値テスト (1 / 50 / 0 / 51 / 1.5 / 'abc') を網羅しておくとリグレッション検出が楽

### 次回への改善提案

1. **`Cache-Control` ヘッダー付与**
   - `architecture.md:244` で `Cache-Control: s-maxage=60, stale-while-revalidate=300` が明記されているが今回未対応 (requirements で明示的に外していた)
   - 実装後は CDN キャッシュと論理削除のラグを再検討する必要がある (`architecture.md:248〜` の議論を参照)

2. **マークダウンコピーの E2E 自動検証**
   - `data-testid="copy-feedback"` を整備済み。clipboard API は `context.grantPermissions(['clipboard-write'])` などで Playwright 側で許可できる
   - シードデータ (画像 1 件) を Supabase Local に積む整備が前提になる。次の統合テスト基盤整備とセットで追加するのが妥当

3. **Vercel Analytics `markdown_copied` カスタムイベント**
   - PRD KPI で計測対象。`CopyMarkdownButton` の `handleClick` 内で `track('markdown_copied')` を呼ぶ
   - Vercel Analytics の追加・環境変数整備とセットで別 PR

4. **`createdAt` 重複問題への対応**
   - 現状は MVP 範囲として許容。同一ミリ秒に複数登録されたとき、カーソル境界で 1 件スキップされるリスクが残る
   - UUID v7 の活用、または `(created_at, id)` の複合カーソルで「同一 createdAt 内では id desc で続ける」方式が代替案

5. **画像詳細ページ・お気に入り機能との接続**
   - 一覧カードから画像詳細 (`/images/[id]`) への `<Link>` を追加するのは詳細ページ実装と同時の方が自然
   - お気に入りボタンは `Favorite` API 実装後に `ImageCard` に追加する

6. **画像登録フォーム UI の実装**
   - `app/(site)/images/new/page.tsx` と `components/image-register-form.tsx` を実装すると、ヘッダーの「画像を登録する」ボタン経由で全機能のループが閉じる

7. **integration テスト基盤の整備**
   - Supabase Local + 実 Postgres での RLS 検証 (`tests/integration/images/`) を次の `/add-feature` で着手する
   - `GET /api/images` 単体としては unit ではモックでしかテストしていないため、認証なしアクセスで RLS 経由 SELECT が通ることを統合テストで担保したい

### 今回スコープ外として残したもの

- 画像詳細ページ (`app/(site)/images/[id]/page.tsx`) — 別 PR
- お気に入り機能 (PRD #4-A / #4-B) — 別 PR
- 画像登録フォーム UI (`app/(site)/images/new/page.tsx`) — 別 PR
- 画像削除 (PRD #2) / 管理者削除 (PRD #6) — 別 PR
- `Cache-Control: s-maxage=60, stale-while-revalidate=300` — 別タスクで検討
- Vercel Analytics `markdown_copied` カスタムイベント — Vercel Analytics 設定後に別 PR
- 統合テスト・E2E でのコピー操作検証 — Supabase Local 整備後に別 PR
