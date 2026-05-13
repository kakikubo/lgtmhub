# tasklist.md

## タスク一覧

- [x] T1 `UserProfileRepository.findManyByIds(ids[])` を追加 (空配列ガード付き)
- [x] T2 `tests/unit/repositories/user-profile-repository.test.ts` に `findManyByIds` のケースを追加
- [x] T3 `src/services/user-profile-service.ts` を新設 (`findById` / `findManyByIds` / `buildUserProfileService`)
- [x] T4 `tests/unit/services/user-profile-service.test.ts` を新設
- [x] T5 `components/header.tsx` を `buildUserProfileService` 経由に移行
- [x] T6 `docs/repository-structure.md` から Repository 直呼び出し例外節を削除し、Service 一覧に `user-profile-service.ts` を追記
- [x] T7 `biome check` / `tsc --noEmit` / `vitest run` を実行しグリーンを確認 (npm script は rtk hook の出力パース問題があるため node_modules の binary を直接使用)

## 申し送り事項

### 実装完了日
2026-05-13

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| `UserProfileService.findManyByIds` の入力前処理 | 単純な空配列ガード | 重複排除 (`new Set(ids)`) を追加。画像一覧で同一 uploader が複数枚投稿しているケースで Supabase に渡す配列が肥大化するのを防ぐ |
| ドキュメント更新範囲 | 例外節を削除 + Service 一覧に追記 | + ASCII ツリー (`src/services/`) にも `user-profile-service.ts` を追記 (整合性のため) |
| Header の変更 | import + 1 行のみ | 計画通り。挙動は完全同一 (Repository に委譲しているだけ) |
| page.tsx の変更 | Issue 本文に「Header / page.tsx」と記載があったため確認 | `app/(site)/page.tsx` および `components/home-content.tsx` に `UserProfileRepository` 直呼び出しは存在せず、変更不要。Issue 起票時点での認識のずれと判断 |

### 学んだこと

1. **N+1 回避の責務配置**: `findManyByIds` のような複数取得 API は Repository 層に置く (Supabase の `.in()` が SQL の `IN (...)` に変換される 1 クエリ操作だから)。Service 層は dedupe や 0 件ガードといった「ビジネス的な前処理」に責務を限定する。両層に空配列ガードを置く二重防衛は意図的 (Service は契約、Repository は実装の安全網)。
2. **biome の format ルール**: 関数シグネチャの 1 行 → 改行の閾値は文字列長依存。`buildUserProfileService(supabase: SupabaseClient<Database>): UserProfileService` は 1 行に収まる長さなので、改行すると逆に format エラーになる。`biome check --write` で機械的に修正可能。
3. **`UserProfile` の `findById` を Service 経由にしてもオーバーヘッドはほぼ 0**: Service は単純な委譲のみで、ランタイムコストは Repository インスタンス化分のみ (Server Component は毎リクエスト新規生成なので無視できる)。一方で Repository 直呼び出し例外を消すことで「Server Component → Service」の単一ルールに一貫し、新規参加者の認知負荷が下がる。

### 次回への改善提案

1. **画像一覧での投稿者表示 PR (次回)**:
   - `ImageGrid` 経由で `findManyByIds(images.map(i => i.uploaderId))` を呼び、`Map<id, UserProfile>` に変換してから ImageCard へ渡す
   - `app/(site)/page.tsx` (実体は `components/home-content.tsx`) の Server Component で取得し、Client Component には plain object として props で渡す
2. **`repository-structure.md` のテスト ASCII ツリー更新 (out of scope)**:
   - `tests/unit/repositories/` ディレクトリ自体がツリーに無く、`user-profile-repository.test.ts` 等の既存ファイルも未記載
   - implementation-validator から指摘あり。本 PR の関心事 (1PR=1関心事原則) からは外れるため、ドキュメント整理の別 PR で対応推奨
3. **`UserProfile` の TTL キャッシュ検討 (P1 以降)**:
   - Server Component は毎リクエスト Repository / Service を新規構築するが、SSR 単位ではなく request 内で `findById` が複数箇所で呼ばれるケースに備えて、`React.cache()` でリクエスト内メモ化を導入する余地あり
   - 現状は Header からの 1 回呼び出しのみのため不要。画像一覧で投稿者表示が始まった後の負荷次第で検討
