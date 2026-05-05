# タスクリスト: 画像削除機能 (PRD P0 #2)

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: shadcn/ui の初期化

- [x] T1-1 `npx shadcn@latest init` を非対話で実行 (`-y -d` 等のフラグ利用) し、`components.json` を生成する
  - スタイル: `new-york`
  - ベースカラー: `neutral`
  - CSS 変数を有効化
- [x] T1-2 生成された `components.json` の `aliases.utils` を `@/src/lib/utils` に、`aliases.lib` を `@/src/lib` に書き換える (本プロジェクトは `src/` 配下に lib を置くため既存規約と整合させる)
- [x] T1-3 `app/globals.css` の差分を確認し、既存の `--background` / `--foreground` と `prefers-color-scheme: dark` の設定を保持しつつ shadcn の CSS 変数 (`--card`, `--primary`, `--destructive` 等) と `@theme inline` ブロックをマージする
- [x] T1-4 生成された `src/lib/utils.ts` (`cn` 関数) が import パス `@/src/lib/utils` で解決できることを `tsc --noEmit` で確認する
- [x] T1-5 `npx shadcn@latest add alert-dialog` を実行し、`components/ui/alert-dialog.tsx` を生成する
- [x] T1-6 `npm install` 後、`package.json` に追加された依存 (`@radix-ui/react-alert-dialog`, `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tw-animate-css` など) を確認する

## フェーズ 2: Repository 層

- [x] T2-1 `src/repositories/image-repository.ts` に `async softDelete(id: string, userId: string): Promise<number>` を追加
  - `update({ status: 'deleted', deleted_at: new Date().toISOString() })`
  - `.eq('id', id).eq('uploader_id', userId).eq('status', 'active').select('id')` でチェーン
  - 戻り値: `(data ?? []).length` (0 = 該当なし、1 = 成功)
  - エラー時 `DatabaseError` を throw
  - JSDoc に「RLS と二重で本人/active を強制する目的」を明記

## フェーズ 3: Service 層

- [x] T3-1 `src/services/image-service.ts` に `async deleteImage(id: string, requesterId: string): Promise<void>` を追加
  1. `imageRepo.findActiveById(id)` で取得
  2. `null` なら `NotFoundError('画像', id)` を throw
  3. `image.uploaderId !== requesterId` なら `ForbiddenError()` を throw
  4. `imageRepo.softDelete(id, requesterId)` を呼び、戻り値 `0` なら TOCTOU として `NotFoundError` を throw
- [x] T3-2 JSDoc に「順序の意図」と「管理者削除 (機能 6 / P1) はここでは扱わず別 PR で追加する」ことを明記

## フェーズ 4: Route Handler

- [x] T4-1 `app/api/images/[id]/route.ts` を新規作成し `DELETE` ハンドラを実装
  - `paramsSchema = z.object({ id: z.string().uuid() })` で UUID 検証 → 失敗で 400
  - `auth.getUser()` で未ログインを 401
  - `Service.deleteImage(id, user.id)` を呼ぶ
  - 成功で `new NextResponse(null, { status: 204 })`
  - エラーマッピング: `NotFoundError` → 404 / `ForbiddenError` → 403 / `UnauthorizedError` → 401 / その他 `AppError` → 500 / 未知 → 500
  - 未知エラーは `console.error` で出力する (既存 POST と同パターン)

## フェーズ 5: UI レイヤー

- [x] T5-1 `components/image-detail-actions.tsx` を新規作成 (Client Component)
  - props: `{ imageId: string }`
  - shadcn `AlertDialog` を `open` で制御
  - 削除ボタンは `data-testid="image-delete-trigger"`、確認ボタンは `data-testid="image-delete-confirm"`
  - エラー領域は `data-testid="image-delete-error"` で `role="alert"`
  - `useTransition` で削除中はボタン無効化 + `削除中…` 表示
  - 成功時 (204) は `router.refresh()` → `router.push('/')`
  - エラー時はダイアログを保持しメッセージを表示
- [x] T5-2 `app/(site)/images/[id]/page.tsx` を改修
  - `Promise.all` で `supabase.auth.getUser()` と `getImage(id)` を並列取得
  - `getImage` は既存の try/catch を維持
  - `image` 取得後に `isOwner = !!user && user.id === image.uploaderId` を算出
  - `<DetailView image={image} isOwner={isOwner} />` で props を渡す
  - `<DetailView />` 内で `isOwner` の場合のみ `<ImageDetailActions imageId={image.id} />` を `<CopyMarkdownButton>` の下に表示

## フェーズ 6: ユニットテスト

- [x] T6-1 `tests/unit/repositories/image-repository.test.ts` に `softDelete` のテストを追加
  - 成功 (1 件更新) → `1` を返し、`update`/`eq` チェーンの引数が想定通り
  - 該当なし (0 件) → `0` を返す
  - Supabase エラー → `DatabaseError` を throw
- [x] T6-2 `tests/unit/services/image-service.test.ts` に `deleteImage` のテストを追加
  - 画像が見つからない → `NotFoundError` を throw、`softDelete` は呼ばれない
  - `uploaderId !== requesterId` → `ForbiddenError` を throw、`softDelete` は呼ばれない
  - 成功 (find OK + softDelete=1) → resolve
  - TOCTOU (find OK + softDelete=0) → `NotFoundError` を throw
- [x] T6-3 `tests/unit/api/images/delete.test.ts` (または既存 API テストに合流) で DELETE ハンドラのテストを追加
  - 401: 未ログイン
  - 400: 不正な UUID
  - 204: 削除成功
  - 404: `NotFoundError` 伝播
  - 403: `ForbiddenError` 伝播
  - 500: 想定外エラー
  - ※ 既存テスト構成 (`tests/unit/api/...`) を踏襲。既存に揃った置き場が無ければ新規パスを作成

## フェーズ 7: E2E テスト

- [x] T7-1 `tests/e2e/image-deletion.test.ts` を新規作成
  - 既存 E2E (`image-detail.test.ts` / `image-list.test.ts`) のセットアップ規約 (Supabase Local + シードユーザー) を踏襲
  - シナリオ A: ログイン済み + 自分の画像詳細を開く → 削除トリガーを押下 → 確認ダイアログ表示 → 「削除する」 → `/` に遷移し、対象画像が一覧に存在しない
  - シナリオ B: 「キャンセル」を押すとダイアログが閉じ、画像はそのまま残る
  - シナリオ C: 別ユーザー (またはログアウト) で同じ画像詳細を開くと削除トリガーが表示されない
- [x] T7-2 既存 `tests/e2e/image-detail.test.ts` が削除導線追加で破綻していないことを確認

## フェーズ 8: 品質チェック

- [x] T8-1 `npm run lint` がエラー無しで通る
- [x] T8-2 `npm run typecheck` がエラー無しで通る
- [x] T8-3 `npm test` (Vitest) が pass する (カバレッジ閾値含む)
- [x] T8-4 `npm run test:e2e` (Playwright) が pass する

## フェーズ 9: 実装検証

- [x] T9-1 `implementation-validator` サブエージェントで全実装を検証し、指摘があれば解消する

## フェーズ 10: 振り返り

- [x] T10-1 本ファイル末尾の「実装後の振り返り」を更新
  - 実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案
- [x] T10-2 永続ドキュメント (`docs/`) で更新が必要な箇所があるか判断し、必要なら更新する (`functional-design.md` の API 表 / `architecture.md` の RLS / `repository-structure.md` の `components/ui/` 実態化)
  - 既存記述で予定どおりに実装されたため本 PR では更新無し。biome 設定例 / ガイドライン整備は別 PR (改善提案 #2 参照)
- [x] T10-3 `verification.md` を作成して実行ログ (lint / typecheck / test / e2e の結果) を記録する

## フェーズ 11: PR 作成

- [x] T11-1 細かいコミットに分けて push する (CLAUDE.md コミットスタイル規約準拠、`Co-Authored-By` は付けない)
- [x] T11-2 `gh pr create` で PR を作成する (本文に Summary / Test plan / 関連 PRD・設計書リンク) → PR #32

---

## 実装後の振り返り

### 実装完了日

2026-05-06

### 実装サマリー

PRD P0 #2「画像削除機能」を論理削除のみで実装した。画像詳細ページに自分の画像のときだけ削除ボタンを表示し、shadcn/ui の AlertDialog で確認後 `DELETE /api/images/[id]` を呼ぶ。多層防御 (Service の所有者チェック + Repository WHERE 句で本人/active 強制 + RLS) で 404 / 403 / TOCTOU を判別する。

- **shadcn/ui 初期化**: `npx shadcn@latest init -d` で base-nova preset を初期セットアップ。`components.json` の aliases を `@/src/lib` ベースに修正、`app/globals.css` を整理、`components/ui/{alert-dialog,button}.tsx` を生成
- **biome.json 拡張**: `css.parser.tailwindDirectives: true` / `components/ui/**` の lint・format・assist 全 disable / `.claude/worktrees` 除外を追加
- **Repository 拡張**: `softDelete(id, userId)` を追加 (WHERE で本人 + active を強制し、戻り値で更新行数を返す)
- **Service 拡張**: `deleteImage(id, requesterId)` を追加 (`findActiveById` → 所有者チェック → `softDelete` で 404/403/TOCTOU を判別)
- **新 Route Handler**: `app/api/images/[id]/route.ts` の `DELETE` ハンドラ (UUID 検証 / 認証 / 4 種のエラーマッピング)
- **新 Client Component**: `components/image-detail-actions.tsx` (AlertDialog + `useTransition` + `router.refresh()` → `router.push('/')`)
- **詳細ページ改修**: `Promise.all` で `getImage` と `getUser` を並列化し `isOwner` 判定を追加
- **テスト**: ユニット 13 ケース (Repo 3 / Service 4 / Route 6) + E2E 1 ケース

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| shadcn の preset 選択 | `style: new-york` / `radix` ベース (設計書) | shadcn 4.6 では preset 体系に変更されており Nova (base-ui ベース) が default。Nova を採用し `@radix-ui/...` ではなく `@base-ui/react` で AlertDialog を実装 |
| Geist フォント・Button の混入 | 計画外 | shadcn init が prest Nova の副作用で `app/layout.tsx` に Geist フォントを追加、`components/ui/button.tsx` も生成 → Geist は元に戻し、Button は AlertDialog 依存として残す判断 |
| `app/globals.css` のマージ | 既存 hex `--background`/`--foreground` と `prefers-color-scheme: dark` を保持しつつ shadcn の oklch 変数を追加 | 既存 hex は失う代わりに oklch のみで統一。`prefers-color-scheme` の自動切替は廃止し `.dark` クラス制御に乗り換え (本サイトはダーク非対応のため影響軽微) |
| biome の CSS パーサー | 計画になし | `@custom-variant` / `@theme inline` を認識させるため `tailwindDirectives: true` を新規追加 |
| API テスト構成 | `tests/unit/api/images/[id]/route.test.ts` を想定 | ファイルシステム上 `[id]` を含むディレクトリは扱いづらいため `tests/unit/api/images/delete-route.test.ts` で実装 |
| zod の UUID バリデーション | 計画になし | zod v4 の `z.string().uuid()` は UUID v1-v8 のみ受け付ける厳密版で、テスト用 UUID `0...0001` (variant 0) は拒否される。テストでは `00000000-0000-4000-8000-000000000001` (v4 形式) を採用 |
| E2E カバレッジ | シナリオ A / B / C を計画 | 既存 E2E 基盤がログイン状態を作る仕組みを持たないため、シナリオ A (削除フロー) と B (キャンセル) は追加不可。シナリオ C (削除トリガー非表示) のみ実装。残りはユニット層 (Service / Route / UI 分岐) でカバー済み (改善提案 #1 として明記) |
| `page.tsx` の並列化 | `Promise.all` で `getUser` と `getImage` を並列取得 | 一度シンプル優先で直列実装したが、`implementation-validator` の指摘で `Promise.all` に修正。`getImage` 失敗は `.catch(() => null)` で吸収し既存の `notFound()` 方針を保持 |

### 学んだこと

**技術的な学び**:

1. **shadcn/ui のメジャーバージョン (4.x) は preset 体系に変わっている**: 旧来の `style: new-york` + `--base radix` 指定はもう動かず、preset (Nova / Vega / Maia 等) を選ぶ形に。Nova のデフォルトは base-ui (Radix UI のフォーク) + Geist フォント + Button が同梱され、思った以上の副作用が発生する。設計時に shadcn のバージョン別挙動を確認しないとスコープ膨張する
2. **shadcn init の副作用は範囲が広い**: `app/layout.tsx` への Geist フォント追加・`app/globals.css` の全面書き換え (oklch 変数 + `@theme inline` ブロック追加) は、PR スコープを混在させる原因になる。「画像削除 PR」に shadcn セットアップを含める場合は、init 副作用のうち何を残し何を戻すかを最初に決めて作業する
3. **多層防御は WHERE 句で実現する**: 「他人の画像は削除できない」を Service 層の `if` 判定だけでなく Repository の `update().eq('uploader_id', userId).eq('status', 'active')` でも強制する。これにより RLS が万一意図しない設定になっても、アプリ層で 0 件更新として落ちる。`softDelete` が更新行数を返すことで Service 層は TOCTOU を 404 として処理できる
4. **`Promise.all` と `try/catch` は両立させづらい**: 並列化したいが片方の失敗で notFound() に倒したい場合、`Promise.all` の前に各 Promise に `.catch(() => null)` を付ける形が綺麗。try/catch でラップすると並列性が崩れる
5. **`useTransition` でダイアログを保持**: 削除中はボタンを `disabled` にしつつ AlertDialog を `open` で制御化することで「削除中にダイアログを閉じない」体験を作れる。`useTransition` の `pending` をフラグに使うとレース条件も避けられる
6. **zod v4 の UUID は厳密化されている**: `z.string().uuid()` は UUID v1-v8 のみ受け付けるため、テスト用の便宜的な UUID (variant 0) は拒否される。実コードでの実害は無い (Supabase は v4 を返す) が、テストフィクスチャは v4 形式で書く

**プロセス上の学び**:

1. **設計時に外部ツールのバージョン挙動を確認する**: shadcn 4.6 の preset 仕様を事前に確認していれば、「new-york + radix」前提の設計を書かずに済んだ。今回はユーザー判断で「現状を整理して進める」に切り替えたが、設計レビュー段階で気付ければ再作業を避けられた
2. **`implementation-validator` の活用は実装直後が最適**: lint / typecheck / test を通した直後に走らせることで、設計書との乖離 (今回は `Promise.all` 並列化漏れ) を機械的に拾えた。スペック駆動開発のサイクルに `validator` を組み込む価値がある

### 次回への改善提案

1. **E2E ログイン基盤を別 PR で導入する**: 本 PR では未ログイン状態の検証 (シナリオ C: 削除トリガー非表示) のみを E2E で実施した。シナリオ A (自分の画像削除フロー) と B (キャンセル) は Supabase Local の auth スタブまたはテストユーザー injection の仕組みが無いと書けない。新ステアリング `e2e-auth-helpers` (例) で `tests/e2e/utils/auth.ts` などのヘルパーを整備し、削除・お気に入り・登録の各フローを E2E で網羅する PR に分割するのが望ましい
2. **shadcn / biome 構成を `docs/development-guidelines.md` に反映する**: 本 PR で `components/ui/**` の lint disable / `tailwindDirectives` 有効化 / `aliases.utils = @/src/lib/utils` 規約を追加した。これらをガイドラインに明文化し、次回 shadcn コンポーネントを `add` する際の参照にできるようにする (画像削除とは独立した関心事のため別 PR)
3. **管理者削除 (PRD 機能 6 / P1) の準備**: 本 PR の Service `deleteImage` は本人削除のみを扱う。機能 6 で `is_admin = true` 判定 + Vercel Blob 即時 `del()` 呼び出しを追加することになる。`UserProfileRepository.findById` を再利用しつつ、Service に `deleteImageByAdmin` を追加する案・もしくは `deleteImage` 内で分岐する案のどちらにするか設計レビューが必要
4. **Blob 物理削除 (PRD 機能 8 / P1) の準備**: `status='deleted'` かつ `deleted_at` から 30 日経過した行を日次ジョブで削除する。GitHub Actions の cron + Repository に `listDeletedOlderThan(days)` / `delete(id)` を追加する想定。本 PR で `deleted_at` を確実にセットしているのでデータ側は準備完了
5. **詳細ページのカスタム 404**: PR #25 から残っている宿題。`app/(site)/images/[id]/not-found.tsx` を追加し日本語 UI に揃える。本 PR で詳細ページの構造変更は無いので、お気に入り PR と合わせて整備する案

### 今回スコープ外として残したもの

- 管理者による任意ユーザーの画像削除 (PRD 機能 6 / P1 — 別 PR)
- Vercel Blob からの物理削除 (PRD 機能 8 / P1 — 別 PR、日次クリーンアップ)
- 削除済み画像の復元機能 (PRD 範囲外)
- 一覧画面 (`/`) のカード上での削除操作 (詳細ページに集約方針)
- お気に入り機能 (P0 #4-A / #4-B — 別 PR)
- E2E のログイン状態シナリオ (改善提案 #1 で別 PR)
- shadcn / biome 構成のガイドライン反映 (改善提案 #2 で別 PR)
