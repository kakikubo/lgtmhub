# 要求内容

対象 Issue: [#198 LGTM画像のお気に入り機能を追加する](https://github.com/kakikubo/lgtmhub/issues/198)

## 概要

ログインユーザーが気に入った LGTM 画像をハートで登録し、専用ページ `/favorites` で見返せるようにする。
`docs/product-requirements.md` / `docs/functional-design.md` で P0 として定義済み・未実装の機能を実装する。

## 背景

- 現状、気に入った画像を後から探し直す手段がない。
- PRD 機能 4（お気に入り追加/解除・お気に入り一覧）は P0 で定義済みだが、`favorites` テーブル・API・専用ページのいずれも未実装。
  `app/api/favorites/` はディレクトリ枠（`.gitkeep`）のみ。
- 認証基盤（Supabase Auth / `user_profiles`）が既にあるため、ユーザー単位のサーバー保存を低コストで実現できる。
- 参照元の lgtmoon は匿名 localStorage 保存だが、本機能は **認証ユーザー単位で DB 保存**（デバイス間同期可能）とする。

## 実装対象の機能

### 1. `favorites` テーブルと RLS

- `(user_id, lgtm_image_id)` UNIQUE、`user_profiles` / `lgtm_images` への FK（ともに `on delete cascade`）。
- RLS で本人のみ自分の行を SELECT / INSERT / DELETE 可能（`auth.uid() = user_id`）。
- お気に入り数の集計・公開はしない（非公開・個人リストのみ）。

### 2. お気に入り API

- `POST /api/favorites` — 登録。Body `{ lgtmImageId }`。認証必須。
- `DELETE /api/favorites/[lgtmImageId]` — 解除。認証必須。冪等（未登録は 404、UI 側でエラー扱いしない）。
- `GET /api/favorites?cursor=&limit=` — 一覧。カーソルページネーション。`createdAt` は **お気に入り登録日時**、降順。
  `lgtm_images.status = 'active'` で論理削除済み画像を除外する。
- `GET /api/favorites/ids` — 自分がお気に入り登録済みの画像 ID 一覧。認証必須。
  一覧カード／詳細ページのハートの初期状態（塗りつぶし or 輪郭）を決めるために必要。

### 3. お気に入りトグル UI（ハート）

- 一覧カード（`components/image-card.tsx`）と画像詳細ページの両方に配置する。
- lucide `Heart`。未登録＝輪郭、登録済＝塗りつぶし。既存のコピーボタンと並ぶ配置・スタイルに揃える。
- オプティミスティック更新。API 失敗時は元に戻してトーストでエラー表示。
- 未ログイン時もボタンは常に表示し、押すと GitHub OAuth ログインへ誘導する。

### 4. お気に入り一覧ページ

- `app/(site)/favorites/page.tsx` を新設。トップと同じカード / グリッド / ページネーション体系を流用する。
- 空状態のメッセージを表示する。
- 未ログインでアクセスした場合はログイン誘導を表示する。
- ヘッダーの「お気に入り」リンクは **ログイン時のみ** 表示する。

## 受け入れ条件

### favorites テーブル / RLS
- [ ] `favorites` テーブルと RLS が適用され、本人のレコードのみ操作できる。
- [ ] `src/types/database.types.ts` が再生成され `favorites` を含む。

### API
- [ ] `POST /api/favorites` で登録でき、重複登録は 409 になる。
- [ ] `POST /api/favorites` で存在しない / 削除済み画像を指定すると 404 になる。
- [ ] `DELETE /api/favorites/[lgtmImageId]` で解除でき、未登録時は 404（UI はエラー扱いしない）。
- [ ] `GET /api/favorites` がお気に入り登録日時の降順で返り、カーソルページネーションが動く。
- [ ] `GET /api/favorites` で論理削除済み（`status='deleted'`）画像が除外される。
- [ ] いずれの API も未認証で 401 を返す。

### UI
- [ ] 一覧カードと詳細ページの両方にハートトグルが表示され、登録 / 解除がオプティミスティックに反映される。
- [ ] API 失敗時に UI がロールバックし、トーストでエラーが表示される。
- [ ] 未ログインでハートを押すと GitHub ログインへ誘導される。
- [ ] ログイン時のみヘッダーに「お気に入り」リンクが表示され、`/favorites` でお気に入り一覧が見られる。
- [ ] お気に入りが 0 件のとき空状態メッセージが表示される。

### テスト
- [ ] `FavoriteService` / `FavoriteRepository` のユニットテストが通る。
- [ ] お気に入り API 4 本の route handler ユニットテストが通る。
- [ ] `FavoriteButton` / `favorite-store` のコンポーネントテストが通る。
- [ ] 登録 → 一覧表示 → 解除の e2e が通る。

## 成功指標

- `pnpm run test` / `pnpm run lint` / `pnpm run typecheck` / `pnpm run build` が通る。
  `pnpm run check` は本タスク着手時点から既存の
  `tests/unit/lib/image/compose-lgtm.test.ts` にフォーマット差分があり失敗する。
  本タスクの変更に起因しないため、この 1 件のみ許容する（CI のゲートは `pnpm run lint`）。
- 既存のカバレッジ閾値（`src/services/**`, `src/lib/**`, `app/api/images/**`）を割らない。

## スコープ外

Issue #198 の Out of Scope に従い、以下は実装しない:

- お気に入り数の公開表示・人気順ランキング
- localStorage ベースの匿名お気に入り／未ログイン → ログイン時のマージ
- お気に入りのカテゴリ分け・フォルダ・並び替えカスタマイズ
- 削除済み画像を「削除済み」としてグレーアウト表示すること
- 汎用トーストライブラリの導入（お気に入り用の最小トーストのみ実装する）

## 参照ドキュメント

- `docs/product-requirements.md` - 機能 4（お気に入り）
- `docs/functional-design.md` - エンティティ Favorite / お気に入り API / RLS
- `docs/architecture.md` - レイヤー構成・キャッシュ戦略
- `docs/repository-structure.md` - 「未実装の P0 機能（お気に入り）で追加予定のファイル」
- `app/api/CLAUDE.md` / `src/CLAUDE.md` / `supabase/CLAUDE.md` - 各層の規約
