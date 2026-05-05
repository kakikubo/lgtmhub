# 要求内容

## 概要

PRD P0 #2「画像削除機能」を実装する。
ログイン済みユーザーが自分の登録した LGTM 画像を、画像詳細ページ (`/images/[id]`) 上の削除ボタンから論理削除できるようにする。

P0 範囲では Vercel Blob 上の画像実体は削除しない (P1 機能 8「削除画像の物理クリーンアップ」で 30 日後に物理削除する予定)。

## 背景

- 画像詳細ページ `/images/[id]` は PR #25 で main にマージ済み (削除機能の入口を想定済みのレイアウト)
- 一覧 / 詳細 / お気に入りのいずれも `status='active'` でフィルタしているため、`status='deleted'` に更新するだけで自動的に非表示になる
- 既存マイグレーション `lgtm_images` の RLS には「本人 or 管理者のみ UPDATE 可」のポリシーが定義済み (機能 6 / 管理者削除を見据えた既存実装)
- shadcn/ui はプロジェクト未導入。本作業で初期化し、AlertDialog コンポーネントを追加する

## 実装対象の機能

### 1. shadcn/ui の初期化 (本作業の前提セットアップ)

- `npx shadcn@latest init` で `components.json` と `src/lib/utils.ts` (`cn()`) を生成する
- Tailwind CSS v4 / React 19 と整合する設定で初期化
- `components/ui/alert-dialog.tsx` を `npx shadcn@latest add alert-dialog` で追加
- 関連依存 (`@radix-ui/react-alert-dialog`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` 等) を `package.json` に追加

### 2. 画像削除 API (`DELETE /api/images/[id]`)

- ログイン必須。未ログインは 401
- 対象画像が存在しない / `status='deleted'` の場合は 404
- 対象画像の `uploader_id` が認証ユーザーと異なる場合は 403
- 上記いずれでもない場合、`status='deleted'` / `deleted_at=now()` に更新して 204 を返す
- Vercel Blob の物理削除は行わない (P1 機能 8 で別途実装)

### 3. ドメイン層の拡張

- `ImageRepository.softDelete(id, userId)`: `status='active'` かつ `uploader_id=userId` の 1 件を `status='deleted'` / `deleted_at=now()` に UPDATE する
  - 戻り値: 更新された行数 (0 件 = 該当なし、1 件 = 成功)
  - `userId` の一致を WHERE 句に明示することでアプリ層でも所有者保証 (RLS だけに頼らない多層防御)
- `ImageService.deleteImage(id, userId)`:
  - 先に `findActiveById(id)` で存在確認 → 無ければ `NotFoundError`
  - `image.uploaderId !== userId` なら `ForbiddenError`
  - その後 `softDelete(id, userId)` を実行

### 4. 画像詳細ページの UI 拡張

- ログイン済み + 自分の画像のときだけ「削除」ボタンを表示する
- ボタン押下で shadcn/ui の `AlertDialog` を開き、「削除する / キャンセル」を提示する
- 「削除する」で `DELETE /api/images/{id}` を呼び出し、成功時に `/` (一覧) へ遷移しキャッシュを無効化する
- 削除中はボタンを無効化し処理中表示にする
- API エラー時は画面上でエラーメッセージを表示する (画面遷移はしない)
- 認証情報の取得は `app/(site)/images/[id]/page.tsx` (Server Component) 側で行い、所有者フラグだけクライアントコンポーネントに渡す

## 受け入れ条件

### 削除 API

- [ ] 未ログインで `DELETE /api/images/{id}` を呼ぶと 401 を返す
- [ ] 存在しない ID / `status='deleted'` の ID では 404 を返す
- [ ] 他ユーザーの画像 ID では 403 を返す
- [ ] 自分の画像なら 204 を返し、DB の `status` が `'deleted'` に、`deleted_at` が NOT NULL に更新されている
- [ ] 削除済みの画像は一覧 (`GET /api/images`) と詳細 (`/images/[id]`) からも見えなくなる

### 画像詳細ページ

- [ ] 未ログインで自分以外の画像詳細を開いても削除ボタンは表示されない
- [ ] ログイン済み + 自分の画像の詳細を開くと削除ボタンが表示される
- [ ] 他人の画像の詳細を開くと削除ボタンは表示されない
- [ ] 削除ボタンを押すと AlertDialog が開き、「削除する」「キャンセル」が選べる
- [ ] 「キャンセル」でダイアログが閉じ、画像は削除されない
- [ ] 「削除する」で API が呼ばれ、成功すると `/` に遷移する
- [ ] API 失敗時はエラーメッセージが表示され、ページに留まる

### ドメイン層

- [ ] `ImageRepository.softDelete` が成功時に更新行数 1、該当なしで 0 を返す
- [ ] `ImageRepository.softDelete` が Supabase エラー時に `DatabaseError` を throw する
- [ ] `ImageService.deleteImage` が存在しない / 削除済みで `NotFoundError` を throw する
- [ ] `ImageService.deleteImage` が他ユーザーの画像で `ForbiddenError` を throw する
- [ ] `ImageService.deleteImage` が成功時に何も throw せず正常終了する

### shadcn/ui 初期化

- [ ] `components.json` がプロジェクトルートに生成されている
- [ ] `src/lib/utils.ts` に `cn()` が定義されている
- [ ] `components/ui/alert-dialog.tsx` が生成されている
- [ ] 関連依存が `package.json` に追加され `npm install` 済み
- [ ] `npm run lint` / `npm run typecheck` がパス

## 成功指標

- 自分の登録した画像を、画像詳細ページから 2 クリック (削除ボタン → ダイアログ確認) で削除できる
- 削除後 1 秒以内に `/` 一覧へ遷移し、当該画像が消えていることを視覚的に確認できる
- ユニットテスト・E2E テスト・型チェック・lint がすべて green

## スコープ外

このフェーズでは実装しない。後続 PR で対応する。

- **Vercel Blob からの物理削除** (P1 機能 8 で実装。本 PR では論理削除のみ)
- **管理者による任意ユーザーの画像削除** (P1 機能 6)
- **削除済み画像の復元機能** (PRD 範囲外)
- **削除時の確認 toast / アンドゥ UI** (シンプル化のため確認ダイアログのみで完結)
- **一覧画面 (`/`) のカード上での削除操作** (詳細ページ経由に集約)
- **お気に入り機能 (P0 #4-A / #4-B)** (別 PR)

## 参照ドキュメント

- `docs/product-requirements.md` - PRD P0 #2 / 機能 8 (物理クリーンアップ) / 機能 6 (管理者削除)
- `docs/functional-design.md` - 削除フロー / RLS 方針
- `docs/architecture.md` - レイヤード境界 (Route Handler → Service → Repository)
- `docs/repository-structure.md` - `components/ui/` の予約定義
- `supabase/migrations/20260504000000_create_lgtm_images.sql` - 既存 RLS ポリシー (本人 or 管理者の UPDATE 許可)
- `.steering/20260505-image-detail-page/` - 詳細ページ実装の前提
