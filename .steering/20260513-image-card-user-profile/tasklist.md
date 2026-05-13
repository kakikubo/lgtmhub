# tasklist.md

## タスク一覧

- [x] T1 `src/lib/profile/resolve-uploader-display.ts` を新設 (純関数 `resolveUploaderDisplay` + 定数 `UNKNOWN_UPLOADER_NAME` / `DEFAULT_AVATAR_PATH`)
- [x] T2 `tests/unit/lib/profile/resolve-uploader-display.test.ts` を新設 (profile 有 / 無の両ケースをユニットテスト)
- [x] T3 `public/default-avatar.svg` を追加 (24×24 円形プレースホルダー)
- [x] T4 `components/image-card.tsx` に `profile?: UserProfile` を追加し、アバター + 表示名 + フォールバック行を実装
- [x] T5 `components/image-grid.tsx` に `profiles?: Map<string, UserProfile>` を追加し、`ImageCard` に `profile` を渡す
- [x] T6 `components/home-content.tsx` で `buildUserProfileService(supabase).findManyByIds(...)` を 1 回だけ呼び、Map を構築して `ImageGrid` に渡す (取得失敗時は空 Map で graceful degrade)
- [x] T7 `docs/development-guidelines.md` に「画像一覧で投稿者を表示する場合は `findManyByIds` を 1 回のみ呼ぶ」ガイドラインを追記
- [x] T8 `tests/e2e/image-list.test.ts` に「投稿者名行が表示される」確認を追加
- [x] T9 `biome check --write` / `tsc --noEmit` / `vitest run` を実行しグリーン確認 (npm script ではなく node_modules バイナリ直接実行を優先)

## 申し送り事項

### 実装完了日
2026-05-13

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| ブランチ運用 | worktree 既定 (`worktree-6`) で直接作業を想定 | `feat/user-profile-service` (Issue #6 で新設した `UserProfileService` を含む / 未マージ) が前提のため、`feat/image-card-user-profile` を `feat/user-profile-service` から派生させて作業。worktree 内で `git switch -c feat/image-card-user-profile feat/user-profile-service` を実行 |
| `HomeContent` の並列化 | `Promise.all` 1 段で `auth.getUser` / `getHomeImagesInitial` / `findManyByIds` を全部並列 | 投稿者プロフィール取得は `imagesResult` の `uploaderId` 配列に依存するため、構造上 2 段直列にせざるを得ない。1 段目で images + auth を並列、2 段目で `fetchUploaderProfileMap` を直列に呼ぶ形に整理 (graceful degrade のため `.catch` で空 Map にフォールバック) |
| `ImageCard` 単体のユニットテスト | Issue 完了条件にあったが、現状 Vitest は node 環境のみ (RTL/jsdom 未導入) | RTL を新規導入するとスコープが過大になるため、(1) `resolveUploaderDisplay` の純関数ユニットテスト、(2) Playwright E2E (`image-card-uploader` testid のカウント / 表示名非空) で代替。design.md に方針を明記 |
| `biome check` の対象指定 | `node_modules/.bin/biome check --write .` のみ | worktree 環境 (`.claude/worktrees/` 配下) は biome.json の `!**/.claude/worktrees` で除外されるため、`components/ src/ tests/ docs/ public/` を明示指定して実行 |

### 学んだこと

1. **Server Component での 2 段データ取得は素直に await 直列**: `findManyByIds` が画像一覧の `uploaderId` に依存する場合、`Promise.all` で並列化しようとすると冗長な型遊びが増える。一段目で `images` を確定させ、二段目で `findManyByIds` を呼ぶ自然な直列で OK。失敗時のフォールバック (`[]` → 空 Map) を `.catch` でラップすると graceful degrade が局所化する。
2. **Map は Server Component 内で留めて plain object で渡す**: `ImageGrid` に `Map<string, UserProfile>` を渡すか、`Map.get(...)` の結果を `ImageCard` ごとに `UserProfile | undefined` で渡すか。後者を選ぶと将来 `ImageCard` を Client Component 化したときの serialization 境界に Map を置かずに済む。
3. **biome.json の `.claude/worktrees` 除外と worktree 運用の相性**: ルートからの相対パスベースで除外しているため、worktree 内では `biome check .` が「対象 0 件」になる。前回 (`20260513-user-profile-service`) の申し送りで触れられていた "npm script は rtk hook の出力パース問題" と組み合わさり、worktree 作業時は **node_modules バイナリ直接 + 明示パス指定** が安定する。

### 次回への改善提案

1. **`LoadMoreButton` 経由の追加読み込みでも投稿者表示する (別 PR)**:
   - 現状は初期表示分の `findManyByIds` のみ。`LoadMoreButton` の Server Action 内で同様に `findManyByIds(images.map(i => i.uploaderId))` を呼んで `ImageGrid` に渡す必要がある。
   - 関心事は「LoadMore 経由の投稿者解決」に限定し、本 PR (初期表示) とは別 Issue で対応 (1PR=1関心事)。
2. **画像詳細ページでの投稿者表示 (別 PR)**:
   - Issue #98 のスコープ外。詳細ページは 1 件取得なので `buildUserProfileService(supabase).findById(uploaderId)` で完結する。`Map` 構築は不要。
3. **コンポーネントレベル単体テストの基盤 (中長期)**:
   - 現状 RTL/jsdom は未導入。`ImageCard` 内の DOM 構造の回帰検知は E2E で行っているが、将来コンポーネント単位の論理分岐が増えたら React Testing Library + `@testing-library/jest-dom` 相当の vitest 連携を別 PR で導入する余地あり。
4. **デフォルトアバター SVG の配色**:
   - 現状 Tailwind の gray-200 / gray-400 (`#e5e7eb` / `#9ca3af`) ハードコード。design system 化したら CSS 変数化を検討。

