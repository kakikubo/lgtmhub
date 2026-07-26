# requirements.md

## 背景

GitHub Issue [#6](https://github.com/kakikubo/lgtmhub/issues/6) 対応。

PR #2 で `UserProfileRepository.findById` は Server Component (`components/header.tsx` 等) から直接呼ばれており、
`docs/repository-structure.md` に「Server Component → Repository 直呼び出し」の **明文化された例外** として記載されている。

申し送り事項 (`/.steering/20260503-github-oauth-auth/tasklist.md` の項目 2) に従い、画像一覧で投稿者プロフィール
(アバター / 表示名) を表示するようになるタイミングで `UserProfileService` を新設する。

本 PR では UI への投稿者表示は含めず、**Service 層の整備とそれに伴う移行**にスコープを絞る (1PR = 1関心事)。

## 完了条件 (Issue 本文より)

- [ ] `src/services/user-profile-service.ts` を新設
- [ ] `findManyByIds(ids: string[])` で複数取得をサポート (N+1 回避の構造を提供)
- [ ] `components/header.tsx` 等の Repository 直呼び出しを Service 経由へ移行
- [ ] `docs/repository-structure.md` の例外節を更新 (例外を削除し、Service 経由に統一)

## スコープ

### 含むもの

1. `UserProfileService` の新設
   - `findById(id)`: 単一取得 (Header / Layout で利用)
   - `findManyByIds(ids[])`: 複数取得 (1 クエリ = N+1 回避)
2. `UserProfileRepository.findManyByIds(ids[])` の追加 (Service が依存するため)
3. `components/header.tsx` を Service 経由に移行
4. `docs/repository-structure.md` の例外節を更新 (Repository 直呼び出し例外を削除/Service 経由に統一)
5. ユニットテスト (Service / Repository 双方)

### 含まないもの

- 画像カードへの投稿者アバター / 表示名表示 (= `findManyByIds` の実利用) は別 PR
- `syncFromAuth(userId)` 等の書き込み系メソッド (P1 以降の課題)

## 非機能要件

- N+1 を構造的に発生させない API 形状にする (Service が `ids[]` 入力を受け取る)
- 既存テスト / Lint / TypeCheck をすべてパスする
- `as` キャスト・`any` を増やさない (development-guidelines 準拠)
