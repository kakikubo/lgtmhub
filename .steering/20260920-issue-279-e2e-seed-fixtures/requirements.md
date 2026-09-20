# 要求内容

## 概要

e2e テストの条件付き `test.skip()` を廃止し、決定的なシードデータを前提に無条件でアサートする。
Issue #279。

## 背景

`tests/e2e` の一覧・詳細・削除・お気に入り系テストは、`image-grid` が出ていない
(= 画像 0 件 / DATABASE_ERROR) ときに実行時 `test.skip()` して緑になる実装だった。

- `tests/e2e/image-list.test.ts:33,49,74,94`
- `tests/e2e/image-detail.test.ts:12,47,73,83`
- `tests/e2e/image-deletion.test.ts:12`
- `tests/e2e/favorites.test.ts:33`（Issue 本文には未記載だが同一パターン）

CI の Supabase Local は空 DB で起動するため、**これらのテストは CI で常に skip され、
何もアサートせずスイート全体がパスしていた**（サイレント no-op）。回帰を検出できない
テストが「緑」を出し続けるため、偽の安心感につながる。

## 実装対象の機能

### 1. 決定的なシードデータ

- `supabase/seed.sql` に固定 UUID の LGTM 画像フィクスチャと、その投稿者となる
  専用シードユーザーを投入する
- `supabase start` / `supabase db reset` のタイミングで適用されるため、
  **CI では `pnpm run build` より前に DB へデータが存在する**（トップページの
  `'use cache'` 一覧がビルド時プリレンダで空をキャッシュしてしまう事故を防ぐ）
- e2e の `globalSetup` が毎回作り直すテストユーザーとは別ユーザーにし、
  テストユーザー削除の cascade でフィクスチャが消えないようにする

### 2. 条件付き skip の廃止

- 上記 4 ファイルの計 10 箇所の実行時 `test.skip()` を削除し、無条件アサートにする
- 「grid / empty / error のいずれか」を許容していたアサートは `image-grid` の表示を直接要求する

### 3. 空状態テストの分離

- 0 件表示の検証は、実データに依存せず**明示的に空状態を作って**行う
  （ランダム表示 API を `page.route` でモックして 0 件応答を返す）

### 4. skip 0 の恒久的な保証

- CI で 1 件でも skip されたら e2e ジョブを失敗させるカスタム reporter を追加し、
  条件付き skip の再混入を検出できるようにする

## 受け入れ条件

### 決定的なシードデータ
- [ ] `supabase db reset` 後、トップページに 4 枚の LGTM 画像が表示される
- [ ] シード画像の投稿者プロフィール (`user_profiles`) が存在し、詳細ページで
      `data-fallback="false"` になる
- [ ] `globalSetup` のテストユーザー再作成でシード画像が消えない

### 条件付き skip の廃止
- [ ] `grep -rn "test.skip" tests/e2e/` が 0 件
- [ ] 4 ファイルのテストが skip なしで実行され、アサートされる

### 空状態テストの分離
- [ ] ランダム表示 API を 0 件でモックしたとき `image-list-empty` が表示される

### skip 0 の保証
- [ ] CI 実行時に skip されたテストがあると e2e ジョブが失敗する
- [ ] ローカル実行 (`CI` 未設定) では従来どおり skip を失敗にしない

## 成功指標

- e2e スイートで skipped 0 件
- 一覧 / 詳細 / 削除 / お気に入りの DOM 回帰が CI で実際に検出できる状態になる

## スコープ外

以下はこのフェーズでは実装しません:

- 画像登録 API (`POST /api/images`) を経由した e2e フィクスチャ投入（外部 URL 取得を伴うため）
- `favorites-authenticated.test.ts` のフィクスチャ投入方式の変更（既に決定的なため）
- Storage バケットへの実ファイル投入（`image_url` は `public/` の既存アセットを指す）
- ページネーション（もっと読み込む）の e2e 追加

## 参照ドキュメント

- `docs/development-guidelines.md` - テスト方針
- `docs/architecture.md` - キャッシュ / Supabase 構成
- `supabase/CLAUDE.md` - マイグレーション / ローカル権限の注意点
