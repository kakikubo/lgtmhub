# 要求内容

## 概要

画像一覧とお気に入り一覧のカーソルページネーションを `(created_at, id)` の複合 keyset に揃え、同一時刻の行がページ境界をまたいでも欠落・重複しないようにする（Issue #327）。

## 背景

`created_at` 単独カーソルでは同一マイクロ秒の行がページ境界で欠落・重複しうる。単一トランザクションの一括 INSERT や将来のバルク API で顕在化しうるため、優先度は低いが規約として揃えて直す。

## 実装対象の機能

### 1. 複合 keyset ページネーション
- `ImageRepository.list` / `FavoriteRepository.listWithImages` を `created_at desc, id desc` + 複合条件にする
- カーソルは `{ createdAt, id }`（クエリ上は JSON 文字列）
- 対応インデックスを migration で追加する

## 受け入れ条件

- [ ] 同一 `created_at` の行がページ境界をまたいでも欠落・重複しない
- [ ] `pnpm audit` 相当ではなく unit / typecheck / biome が通る
- [ ] API の `cursor` / `nextCursor` が複合形式になる

## スコープ外

- RPC 化（今回は PostgREST `.or()` で実装）
- 旧 ISO 単独カーソルの後方互換
