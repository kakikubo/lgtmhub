# 設計

## 方針

PostgREST は複合 keyset を直接表現できないため、`.or()` で

`created_at.lt.X OR (created_at.eq.X AND id.lt.Y)`

を組む。RPC は今回採用しない（既存 Repository パターンを維持し、マイグレーションをインデックス変更に留められるため）。

## カーソル表現

- 内部型: `{ createdAt: string /* ISO 8601 */, id: string /* uuid */ }`
- ワイヤ形式（query / `nextCursor`）: `JSON.stringify` した文字列（`LoadMoreButton` は opaque string のまま）
- 旧 ISO 単独カーソルは 400 にする（破壊的変更を明示）

お気に入りの `id` は **favorites.id**（画像 id ではない）。

## 変更点

| 層 | 内容 |
|----|------|
| `src/lib/pagination/keyset-cursor.ts` | encode / or-filter / zod スキーマ |
| validation | `listImagesQuerySchema` / `listFavoritesQuerySchema` の cursor を複合に |
| repositories | 二次 sort + `.or()`。favorites は select に `id` を追加 |
| services | `nextCursor` を encode |
| migration | `(status, created_at desc, id desc)` / `(user_id, created_at desc, id desc)` |
| docs / steering | functional-design / favorites design のカーソル記述を更新 |

## PostgREST フィルタ

タイムスタンプは `:` を含むため二重引用符で囲む。

```ts
.or(`created_at.lt."${createdAt}",and(created_at.eq."${createdAt}",id.lt.${id})`)
```
