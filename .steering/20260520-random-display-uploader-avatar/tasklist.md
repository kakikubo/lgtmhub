# タスクリスト (Issue #126)

## 実装

- [x] `src/lib/validation/image.ts` の `randomImagesResponseSchema` に `profiles` を追加する
- [x] `app/api/images/random/route.ts` で `buildUserProfileService.findManyByIds` を呼び、`profiles` をレスポンスに同梱する (失敗時 `[]` degrade)
- [x] `components/home-images.tsx` で `profiles` を Map に復元し、ランダムモードの `ImageGrid` に渡す

## テスト

- [x] `tests/unit/lib/validation/image.test.ts` の `randomImagesResponseSchema` に `profiles` を含むケースと必須フィールド検証を追加
- [x] `tests/unit/api/images/random-route.test.ts` を新規作成 (成功 / プロフィール失敗で degrade / listRandomImages 失敗で 500)

## 検証

- [x] `npm test` / `npm run lint` / `npm run typecheck` がパスすることを確認
- [x] `implementation-validator` サブエージェントでコード品質を検証

## 申し送り (振り返り)

- **実装完了日**: 2026-05-20
- **計画と実績の差分**: 計画通り。スコープ追加・変更なし。
- **学んだこと**:
  - Issue #120 (PR #119) で「もっと読み込む」側に同パターン (profiles 同梱 + クライアントで Map 復元) を適用済みだったため、`GET /api/images/random` と `HomeImages` 側にも対称に展開するだけで完了した。
  - `imageListItemSchema` が `listImagesResponseSchema` と `randomImagesResponseSchema` で既に共通化されており、追加フィールドを `imageListItemSchema` に持たせるべき場合の修正漏れを防げる構造になっていた。
  - `randomProfiles` は LoadMoreButton と異なり「再押下でシャッフルし直す」要件 (Issue #109) のためマージではなく置き換える。同じ機能 (profiles 蓄積) でも要件で `setState` 戦略が変わる点をコメント化した。
- **次回への改善提案**:
  - 「クライアント追加 fetch + ImageGrid 描画」を行うコンポーネントが今後増えるなら、`profiles` を Map に復元するヘルパー (`UserProfileResponse[] -> Map<string, UserProfile>`) を抽出すると LoadMoreButton と HomeImages の重複を解消できる。今回は 2 箇所にとどまるため共通化せず据え置き。
  - `app/api/images/route.ts` の GET と `app/api/images/random/route.ts` で `findManyByIds` の呼び出しブロックがほぼ同じ。3 箇所目が出る前にユーティリティ化を検討すると良い。
- **依存 Issue の鮮度確認**: 着手時 local main が 13 コミット遅れていた (Issue #109 / #120 のコミットが未取り込み)。`git pull --ff-only` で更新してから着手。memory `[[dependency-issue-base-branch-staleness]]` の手順通りで詰まらず進められた。
