# タスクリスト

## フェーズ1: 共通カーソルと validation

- [x] `src/lib/pagination/keyset-cursor.ts` を追加する
- [x] `listImagesQuerySchema` / `listFavoritesQuerySchema` を複合カーソルに更新する
- [x] validation の unit テストを更新する

## フェーズ2: Repository / Service

- [x] `ImageRepository.list` を複合 keyset に変更する
- [x] `FavoriteRepository.listWithImages` を複合 keyset に変更する（select に favorites.id）
- [x] `ImageService` / `FavoriteService` の nextCursor を encode する
- [x] repository / service の unit テストを更新し、同一時刻境界の回帰を追加する

## フェーズ3: DB / ドキュメント

- [x] 複合インデックスの migration を追加する
- [x] `docs/functional-design.md` のカーソル仕様を更新する
- [x] `.steering/20260820-issue-198-favorites/design.md` のカーソル仕様を更新する

## フェーズ4: 品質チェック

- [x] `pnpm run check` / `typecheck` / `test` が通ることを確認する

## 実装後の振り返り

### 実装完了日
2026-10-25

### 計画と実績の差分

**計画と異なった点**:
- なし。Issue 記載どおり PostgREST `.or()` を採用し RPC は使わなかった。

**うまくいった点**:
- ワイヤ形式を JSON 文字列にしたことで `LoadMoreButton` を無改造で維持できた。
- 共通ヘルパ `keyset-cursor.ts` に寄せて images / favorites を揃えた。

**改善が必要な点**:
- 旧 ISO 単独カーソルは破壊的に 400 になる。進行中セッションの「もっと読み込む」は再読み込みが必要。
