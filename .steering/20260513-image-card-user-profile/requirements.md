# requirements.md

## 背景

GitHub Issue [#98](https://github.com/kakikubo/lgtmhub/issues/98) 対応。

Issue #6 (`feat/user-profile-service`) で `UserProfileService.findManyByIds` を新設し、
画像一覧で N+1 を発生させずに投稿者プロフィール (アバター / 表示名) を取得できる構造を整えた。
ただし「画像カードに投稿者プロフィールを表示する」UI 自体は未着手のため、本 PR で UI を実装する。

- 関連 Issue: #6 (`UserProfileService` 新設) / #98 (本 PR)
- 申し送り元: `.steering/20260513-user-profile-service/tasklist.md` の「次回への改善提案 1」

## 完了条件 (Issue #98 本文より)

- [ ] `components/home-content.tsx` で `findManyByIds` を呼び、`Map<string, UserProfile>` を構築して `ImageGrid` に渡す
- [ ] `components/image-grid.tsx` / `components/image-card.tsx` のシグネチャに投稿者プロフィール (または `Map`) を追加
- [ ] `ImageCard` にアバター + 表示名の表示を追加 (プロフィール行が無い場合は `Unknown` + デフォルトアバター)
- [ ] デフォルトアバター画像を `public/` 配下に追加
- [ ] ユニットテストを追加 (プロフィール解決ロジックの純関数を切り出し、有無それぞれをテスト)
- [ ] E2E で一覧ページに投稿者名が表示されていることを確認
- [ ] `findManyByIds` が 1 回しか呼ばれていないことを `docs/development-guidelines.md` に明文化

## スコープ

### 含むもの

1. `HomeContent` (Server Component) で `buildUserProfileService(supabase).findManyByIds(...)` を 1 回だけ呼ぶ
2. `ImageGrid` / `ImageCard` のシグネチャ拡張 (plain object を props で受け取る)
3. `ImageCard` への投稿者アバター + 表示名表示 (フォールバック含む)
4. `public/default-avatar.svg` の追加
5. プロフィール解決ロジックを純関数として `src/lib/profile/` に切り出し、ユニットテスト
6. E2E (`tests/e2e/image-list.test.ts`) に投稿者名表示の検証を追加
7. `docs/development-guidelines.md` に N+1 防止ガイドラインを追記

### 含まないもの

- 画像詳細ページでの投稿者表示 (本 Issue スコープ外)
- プロフィールページへの遷移リンク (本 Issue スコープ外)
- お気に入り一覧での投稿者表示 (本 Issue スコープ外)
- 投稿者プロフィールの編集 UI (将来課題)

## UI 仕様 (Issue #98 より)

### 投稿者プロフィール行が存在する場合
- `UserProfile.avatarUrl` を 24px 円形アバターとして表示
- `UserProfile.displayName` を表示

### プロフィール行が存在しない場合 (フォールバック)
- 表示名: 固定文字列 `Unknown`
- アバター: デフォルトプレースホルダー画像 (`/default-avatar.svg`)
- 想定ケース: ユーザーが GitHub 連携を解除した後にレコード側で参照が残る将来パターン

## 非機能要件

- **N+1 防止**: `findManyByIds` は 1 リクエスト内で 1 回のみ。画像 1 件ごとに `findById` を呼ばない
- **LCP への影響**: アバター画像は `next/image` で `sizes` を適切に設定し、画像一覧全体のロードを遅らせない
- **アクセシビリティ**: アバターには `alt` に表示名 (フォールバック時は `Unknown`) を入れる
- 既存テスト / Lint / TypeCheck をすべてパスする
- `as` キャスト・`any` を増やさない (development-guidelines 準拠)
