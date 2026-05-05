# 要求内容

## 概要

PRD P0 #2 (画像削除) と P0 #4-A (お気に入り) の入口になる「画像詳細ページ `/images/[id]`」を MVP として実装する。
画像 1 枚を大きく表示し、マークダウンコピーボタンと一覧へ戻る導線を提供する。

## 背景

- 既存の画像一覧 (`app/(site)/page.tsx`) には個別画像への導線が無い
- 後続 PR で実装予定の以下機能は、すべて「詳細ページが存在する」ことを前提に成立する
  - 画像削除 (P0 #2): 詳細ページに「削除」ボタン
  - お気に入り登録/解除 (P0 #4-A): 詳細ページにハート (一覧側にも置くが詳細にも必要)
  - 重複登録 (409) 時に「既存画像を見る」リンクで `existingImageId` 詳細ページへ誘導
- そのため、本作業は「次の P0 機能を実装可能にするための土台」として位置づける

## 実装対象の機能

### 1. 画像詳細ページ (`/images/[id]`)

- ログイン不要で閲覧できる Server Component
- 画像本体を一覧サムネイルより大きく表示
- マークダウンコピーボタンを 1 つ配置 (一覧と同じ `CopyMarkdownButton` を再利用)
- 「← 一覧に戻る」リンクをページ上部に配置
- 存在しない / 論理削除済み (`status='deleted'`) の画像 ID は Next.js の `notFound()` で 404 を返す

### 2. 画像一覧から詳細への導線

- `components/image-card.tsx` のサムネイル領域を `<Link href="/images/{id}">` でラップ
- マークダウンコピーボタンは引き続きカードの直下に置き、リンク内に含めない (Enter/クリック衝突の回避)

### 3. データ取得層の拡張

- `ImageRepository.findActiveById(id)`: `status='active'` の 1 件取得 (見つからなければ `null`)
- `ImageService.getImage(id)`: Repository を呼び `PublicLgtmImage` を返す。`null` ならそのまま `null` を返す (404 への変換は Page 側で行う)

## 受け入れ条件

### 画像詳細ページ

- [ ] 未ログインで `/images/{有効なID}` にアクセスすると、画像と「マークダウンをコピー」ボタンが表示される
- [ ] 「← 一覧に戻る」リンクが表示され、`/` に戻れる
- [ ] 存在しない ID (`/images/00000000-0000-0000-0000-000000000000` など) では 404 ページが表示される
- [ ] `status='deleted'` の画像 ID では 404 ページが表示される
- [ ] ログイン済みでも同じ画面が表示される (操作系の差分はこの PR では追加しない)

### 一覧からの導線

- [ ] 一覧ページ (`/`) の各画像サムネイルをクリックすると `/images/{id}` に遷移する
- [ ] 「マークダウンをコピー」ボタンを押しても詳細ページに遷移しない (ボタン操作とリンク遷移が分離されている)

### データ取得層

- [ ] `ImageRepository.findActiveById` が `status='active'` の 1 件を camelCase で返す
- [ ] `ImageRepository.findActiveById` が `status='deleted'` / 存在しない ID では `null` を返す
- [ ] Supabase エラー時には `DatabaseError` を throw する
- [ ] `ImageService.getImage` が Repository の戻り値を `PublicLgtmImage` に整形して返す

## 成功指標

- 画像詳細ページの初期表示 (LCP) が 2 秒以内 (PRD 非機能要件 / architecture.md パフォーマンス要件)
- 後続 PR (削除 / お気に入り / 409 リンク) で「詳細ページに UI を足すだけ」で機能が完成する状態にする

## スコープ外

このフェーズでは実装しません。後続 PR で対応します。

- 削除ボタンと `DELETE /api/images/:id` (P0 #2 別 PR)
- お気に入りボタンと `POST/DELETE /api/favorites/...` (P0 #4-A 別 PR)
- 登録フォームの 409 エラー時に「既存画像を見る」リンクを差し込む変更 (`components/image-register-form.tsx`)。詳細ページが本 PR で公開されたあと、別 PR で `existingImageId` を `<Link href="/images/{id}">` に繋ぎ込む
- 投稿者の表示名・アバター表示 (機能設計書「フィールド絞り込み方針」に従い MVP では非表示)
- `GET /api/images/:id` Route Handler (Server Component から Service を直接呼ぶ既存パターンに合わせる。外部から個別取得する API 需要が出た時点で別 PR で追加)
- 画像詳細ページの SNS シェア / OGP (PRD スコープ外)

## 参照ドキュメント

- `docs/product-requirements.md` - PRD P0 #2, #4-A, #5 / 非機能要件
- `docs/functional-design.md` - 画面遷移図 / 画像詳細表示・削除 API のフィールド方針
- `docs/architecture.md` - レイヤード境界 (Server Component → Service 直呼び OK) / パフォーマンス要件
- `docs/repository-structure.md` - `app/(site)/images/[id]/page.tsx` の予約定義
- `.steering/20260504-image-registration-form-ui/tasklist.md` - 申し送り「次回への改善提案 #6」
