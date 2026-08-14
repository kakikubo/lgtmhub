# 要求内容

## 概要

`docs/` 配下のドキュメントが未実装のお気に入り機能を「実装済みの中核機能」として記述している乖離を解消し、`docs/repository-structure.md` の構造図・ファイル名を実装の実態に合わせる。

対応 Issue: [#282](https://github.com/kakikubo/lgtmhub/issues/282)

## 背景

お気に入り機能は未実装（[#198](https://github.com/kakikubo/lgtmhub/issues/198) で追加予定、OPEN）だが、`docs/` の複数ドキュメントが存在しない API・テーブル・ファイルを前提に記述している。新規参加者や AI エージェントが実在しない `POST /api/favorites` や `src/services/favorite-service.ts` を前提に作業してしまうリスクがある。

実装の実態:

- `app/api/favorites/` には `.gitkeep` のみ存在（Route Handler は無い）
- `favorites` テーブルのマイグレーションは存在しない
- `favorite-service.ts` / `favorite-repository.ts` / `favorite-button.tsx` / `src/types/favorite.ts` / `src/lib/validation/favorite.ts` はいずれも存在しない

併せて `repository-structure.md` には favorites 以外の不一致もある:

- マイグレーションファイル名（docs: `20260502...`、実際: `20260503000000_create_user_profiles.sql` 以降）
- `components/ui/` の記載（docs: `button.tsx / dialog.tsx / toast.tsx`、実際: `button.tsx / alert-dialog.tsx`）
- P1 補足例の `image-upload-form.tsx` / `image-upload.test.ts`（既存実装は `image-register-form.tsx`）

## 実装対象の機能

本タスクはドキュメント修正のみで、アプリケーションコードは変更しない。

### 1. 未実装機能（お気に入り）の明示

- お気に入り関連の記述に「未実装 / #198 で実装予定」であることを明示する
- 実装済み機能の記述と未実装機能の記述を読者が区別できるようにする
- 設計内容自体は削除せず、#198 の実装時に設計資産として使えるよう温存する

### 2. `repository-structure.md` の実態反映

- 構造図から実在しないファイル・ディレクトリを取り除き、実在する構成に置き換える
- マイグレーションファイル名を実際のファイル名に修正する
- `components/ui/` の記載を実態（`button.tsx` / `alert-dialog.tsx`）に修正する
- 未実装ファイルは「追加予定のファイル」セクションへ分離する
- P1 補足例のファイル名の誤りを修正する

### 3. 波及ドキュメントの整合

- `functional-design.md` / `product-requirements.md` / `glossary.md` / `architecture.md` のお気に入り記述にも未実装であることを明示する

## 受け入れ条件

### 未実装機能（お気に入り）の明示

- [ ] `docs/functional-design.md` のお気に入り関連セクション（Favorite エンティティ / お気に入り API 3 本 / FavoriteService / favorites RLS / お気に入りタブ・ボタン UI / テスト戦略）に未実装であることが明示されている
- [ ] `docs/product-requirements.md` の「機能4 お気に入り機能」に未実装かつ #198 で実装予定であることが明示されている
- [ ] `docs/glossary.md` の「お気に入り」「Favorite」項目に未実装であることが明示されている
- [ ] `docs/architecture.md` のお気に入りに言及する箇所に未実装であることが明示されている
- [ ] 明示の際は既存ドキュメントの記法（`> **注**:` / `> TODO（将来対応）:`）に揃っている

### `repository-structure.md` の実態反映

- [ ] 構造図に列挙されたファイル・ディレクトリがすべて実在する（未実装のものは「追加予定」セクションへ移動済み）
- [ ] `supabase/migrations/` の記載が実際のファイル名と一致する
- [ ] `components/ui/` の記載が `button.tsx` / `alert-dialog.tsx` と一致する
- [ ] `tests/` の記載が実際のテスト配置と一致する
- [ ] `src/services/` / `src/repositories/` / `src/lib/` / `src/types/` の配置ファイル一覧が実在するファイルのみを列挙している
- [ ] `components/` の一覧が実在するファイルのみを列挙している
- [ ] `app/` の一覧が実在するルートのみを列挙している
- [ ] P1 セクションの `image-upload-form.tsx` / `image-upload.test.ts` が既存の `image-register-form.tsx` と整合する記述になっている
- [ ] ファイル配置規則・命名規則の表で例に挙げているパスが実在する（または未実装と明示されている）

### 全体検証

- [ ] docs 内に記載されたファイルパスのうち、実在しないものはすべて「未実装」「追加予定」と明示されている
- [ ] `pnpm run check` / `pnpm run typecheck` / `pnpm run test` が成功する（コード変更が無いことの確認）

## 成功指標

- docs に記載されたファイルパス・API のうち、実在しないものがゼロ件、または未実装と明示されているものだけになる
- #198 の実装時に、本ドキュメントの「追加予定のファイル」セクションをそのまま設計の起点として使える

## スコープ外

以下はこのフェーズでは実装しません:

- お気に入り機能そのものの実装（#198 で対応）
- `app/api/favorites/.gitkeep` の削除（ディレクトリ予約として温存。実装は #198）
- お気に入り以外の未実装 P1 機能（管理者削除・通報・クリーンアップ・ファイルアップロード）の設計変更
- docs の文章表現・構成の全面的なリライト

## 参照ドキュメント

- `docs/product-requirements.md` - プロダクト要求定義書
- `docs/functional-design.md` - 機能設計書
- `docs/architecture.md` - アーキテクチャ設計書
- `docs/repository-structure.md` - リポジトリ構造定義書
- `docs/glossary.md` - 用語集
