# タスクリスト: 画像登録フォーム UI

## Phase 1: バリデーション・エラーマッピング

- [x] T1-1 `src/lib/validation/image.ts` に `createImageResponseSchema` (`id` / `imageUrl`) を追加
- [x] T1-2 `src/lib/validation/image.ts` に `createImageErrorResponseSchema` (`error` 必須、`existingImageId` 任意) を追加
- [x] T1-3 `src/lib/validation/create-image-error.ts` を新規作成し、`mapCreateImageError(status, body)` 純関数を実装

## Phase 2: Presentation Layer

- [x] T2-1 `components/image-register-form.tsx` (Client Component) を新規作成
  - imageUrl の useState, status, errorMessage, existingImageId
  - クライアント側 zod 検証 → fetch POST → success / error 分岐 → 成功時 `router.refresh()` + `router.push('/')`
  - `data-testid` を整備 (`image-register-form` / `image-register-input` / `image-register-submit` / `image-register-error`)
- [x] T2-2 `app/(site)/images/new/page.tsx` (Server Component) を新規作成し、未ログイン時 `/?auth_error=login_required` にリダイレクト + `<ImageRegisterForm />` 描画 + キャンセル `<Link>`
- [x] T2-3 `components/header.tsx` にログイン済みユーザー向け「画像を登録する」リンクを追加

## Phase 3: ユニットテスト

- [x] T3-1 `tests/unit/lib/validation/image.test.ts` に `createImageResponseSchema` と `createImageErrorResponseSchema` のテストを追加
- [x] T3-2 `tests/unit/lib/validation/create-image-error.test.ts` を新規作成し、`mapCreateImageError` の網羅テスト (400 / 401 / 409 / 429 / 500 / 不正 body / null) を追加

## Phase 4: E2E テスト

- [x] T4-1 `tests/e2e/image-register.test.ts` を新規作成
  - 未ログインで `/images/new` → `/` へ遷移し `auth_error=login_required` が付与される
  - 未ログインの `/` でヘッダーに「画像を登録する」リンクが**表示されない**
- [x] T4-2 既存 `tests/e2e/auth.test.ts` の構成を壊さないことを確認 (regression なし)

## Phase 5: 検証

- [x] T5-1 implementation-validator サブエージェントで全実装を検証し、指摘を解消
- [x] T5-2 `npm run lint` がエラーなしで通る
- [x] T5-3 `npm run typecheck` がエラーなしで通る
- [x] T5-4 `npm test` (vitest) がカバレッジ閾値込みで全件 pass する

## Phase 6: 動作確認手順の整備

- [x] T6-1 `.steering/20260504-image-registration-form-ui/verification.md` を作成し、ローカル実行手順 (Supabase Local + dev サーバ + 登録 → 一覧反映の確認) を記述

## Phase 7: 振り返り

- [x] T7-1 本ファイル末尾に「申し送り事項」を追記 (実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案)
- [x] T7-2 必要に応じて永続ドキュメント (`docs/`) を更新

---

## 申し送り事項

### 実装完了日
2026-05-04

### 実装サマリー

PRD P0 #1「画像登録機能」の UI 部分を MVP 実装した。`POST /api/images` 自体は前作業 (`20260504-image-registration-api`) で実装済みのため、本作業は UI と入出力の整形に絞っている。

- **新規ページ**: `app/(site)/images/new/page.tsx` (Server Component, 未ログインなら `/?auth_error=login_required` にリダイレクト)
- **新規 Client Component**: `components/image-register-form.tsx` (URL 入力 → fetch POST → router.refresh + push)
- **ヘッダー導線**: `components/header.tsx` にログイン済み専用「画像を登録する」リンクを追加。`<Link>` は `<form action={signOut}>` の外側に置き、Enter キー誤送信を回避
- **入出力スキーマ**: `createImageResponseSchema` (201 用) と `createImageErrorResponseSchema` (4xx/5xx 用) を `src/lib/validation/image.ts` に追加
- **エラーマッピング**: `src/lib/validation/create-image-error.ts` に `mapCreateImageError(status, body) → { message, existingImageId?, needsRelogin? }` の純関数を新設
- **テスト**: ユニット 13 件追加 (validation スキーマ 9 件 + mapCreateImageError 12 件)、E2E 2 件追加 (未ログイン redirect / ヘッダーリンク非表示)。合計 124 ケース全 pass、カバレッジ `src/lib/validation/**` 100%

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| 401 判定 | フォームで `res.status === 401` を直参照 | implementation-validator の指摘を受けて、`mapCreateImageError` の戻り値に `needsRelogin?: boolean` を追加し、フォームは `mapped.needsRelogin` を見るよう変更。ステータスコードのマッピング知識が一箇所に集約された |
| `existingImageId` の状態管理 | `existingImageId` を state に保持 (将来の `/images/[id]` 詳細ページ実装時に活用) | 詳細ページが本 PR スコープ外で利用先がないため state 化を見送り、`mapped.existingImageId` を読み取って使わない理由をコメントで残した。詳細ページ実装時に再追加する |
| ヘッダーの `<Link>` 配置 | `<form action={signOut}>` 内に `<Link>` を入れる案 | 兄弟要素として配置 (Enter キー誤送信防止)。validator も「実装の方が正しい」と評価 |
| `<form noValidate>` の意図 | コメントなし | implementation-validator の提案で「ブラウザネイティブの URL バリデーション UI と zod メッセージの二重表示を抑制する」と 1 行コメントを追記 |
| Given-When-Then コメント | development-guidelines.md は明示 | 既存テスト全体で `it(...)` テキストで意図を表現するスタイルが事実上の標準のため、新テストもそれに従った |

### 学んだこと

1. **status code 判定はマッピング関数に押し込むと UI が薄くなる**: `mapCreateImageError` の戻り値に `needsRelogin` のような UI 行動フラグを足すだけで、フォームコンポーネント側から「401 だけ特別扱い」が消える。「マッピング関数 = ステータスコード知識の唯一の所有者」という設計を徹底すると、ロジックの拡張時 (例: 403 を将来追加) もフォームを触らずに済む
2. **`router.refresh()` + `router.push()` のセットが App Router での「再取得して別画面に遷移」の標準パターン**: トップ (`/`) は Server Component で `service.listImages()` を直接叩いているため、`refresh()` を呼ばないとブラウザが SC キャッシュを使い回し、新規登録分が反映されない事故が起きる。両方呼ぶことで「キャッシュ破棄 → 別ページに行く」の順番が確定する
3. **クライアント側の zod は同じスキーマを再利用するのが最も型整合性が高い**: `createImageRequestSchema` を Route Handler とフォームで両方使うと、エラーメッセージ文言まで同期する。フロント独自の正規表現や半製品検証関数を増やさないだけで保守コストが下がる
4. **`<form>` 内に `<Link>` を入れる罠**: HTML 仕様上、`<form>` 内の `<a>` (= Next.js `<Link>`) は Enter キーで暗黙にフォーム送信される可能性がある。設計時に「フォーム要素は最小限」「リンクは外」が安全。今回 implementation-validator がレビュアーとして気付いてくれた
5. **state を持たない選択もコメントで意図を残す**: 「将来必要になる情報を今は捨てる」という判断を口頭ではなくコードコメントに残すと、次回の実装者 (= 自分) が「なぜ捨てているのか」を git blame ではなくその場で読める。ステアリングの requirements.md と整合した方針なら数行で十分

### 次回への改善提案

1. **`/images/[id]` 詳細ページ実装時に既存画像リンク化**
   - `mapCreateImageError` の戻り値 `existingImageId` を state に保持し、エラーメッセージ末尾に `<Link href="/images/{id}">既存画像を見る</Link>` を追加する
   - 本 PR ではスコープ外として明示的に省略している (`requirements.md` 参照)

2. **ログイン済みフローの E2E 自動化**
   - 現状の E2E は未ログイン経路のみ。Supabase Local + テスト用ユーザー (auth.users + user_profiles を fixture に流し込み + cookie をマニュアルで session 化) を整備すれば、フォーム送信 → 一覧反映までを自動検証できる
   - 統合テスト基盤 (前作業 `20260504-image-list-screen` の改善提案 #7) と同じタイミングで進めるのが効率的

3. **登録中の Optimistic UI / プレビュー**
   - 現状は登録ボタン押下 → 完了後に `/` に遷移する同期的な体験。Sharp の合成処理で 5〜10 秒かかる場合に「進捗が見えない」体感が悪化する可能性がある
   - 完了後にトップではなく「登録した画像をプレビュー表示する小さなカード」を一時的にフォーム上に表示する案が UX 的に強い (PRD「処理中インジケーター→完了通知」の意図に近い)

4. **`mapCreateImageError` のメッセージ国際化**
   - 現状はメッセージ文字列をハードコード。MVP では日本語固定で問題ないが、将来的に i18n 対応する場合は `mapCreateImageError` の戻り値をキーにし、UI 側で翻訳する設計が拡張しやすい

5. **`docs/repository-structure.md` の予約定義との整合チェック**
   - 今回追加したファイル (`app/(site)/images/new/page.tsx`, `components/image-register-form.tsx`) は予約定義通り
   - 一方 `src/lib/validation/create-image-error.ts` は予約定義に明記されていない。`development-guidelines.md` の `src/lib/validation/` 配下 (zod スキーマ集約) からは少し責務が膨らんでいる。次回スキーマ周辺のユーティリティを増やす際は、`src/lib/validation/` 内の純関数ファイルの位置付けを repository-structure.md に追記するのが妥当

6. **画像詳細ページ (`/images/[id]`) の実装**
   - 一覧 → 詳細の導線、削除ボタン (P0 #2)、お気に入りボタン (P0 #4-A) の入口になる
   - 詳細ページ実装と同時に `ImageCard` から `<Link href="/images/{id}">` を貼り、登録フォームの 409 エラーから既存画像へ遷移する導線も併せて閉じる

### 今回スコープ外として残したもの

- `/images/[id]` 画像詳細ページ — 別 PR
- 重複時 (409) の既存画像リンク — 詳細ページ実装と同時
- ログイン済みフローの E2E 自動検証 — Supabase Local 統合テスト基盤と同時
- ファイルアップロード対応 (PRD #9, P1) — 別 PR
- 登録中の Optimistic UI / プレビュー — UX 改善 PR で別途検討
- Vercel Analytics `image_registered` カスタムイベント — Analytics 整備と同時に別 PR
- メッセージの i18n — MVP 範囲外

