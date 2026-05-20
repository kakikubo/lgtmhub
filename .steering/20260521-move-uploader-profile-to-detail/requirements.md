# requirements.md

## 関連 Issue

- 本タスク: [#128](https://github.com/kakikubo/lgtmhub/issues/128) 投稿者プロフィール表示をトップページから詳細ページへ移動
- 関連: #98 (投稿者アバター表示の起点), #102 (アバターを GitHub プロフィールリンク化), #126 (ランダム表示でアイコンが出ない不具合)

## 背景

Issue #98 でトップページの `ImageCard` に投稿者アバター + GitHub リンクを表示するようにしたが、一覧で見ると視覚的に煩く感じる。
本来「画像」を見せるのが一覧の主目的のため、投稿者情報は画像詳細ページに移し、一覧はシンプルに戻す。

## やりたいこと

### 1. トップページ (`components/image-card.tsx`)

- 投稿者アバターと GitHub プロフィールへのリンク表示を削除する
- `ImageCard` の `profile` props を削除する
- `components/home-content.tsx` の `fetchUploaderProfiles` 呼び出しと `HomeImages` への profile 受け渡しを削除する (N+1 を避けるため取得していたが、一覧で使わなくなるため)
- 副次的に、`HomeImages` / `ImageGrid` / `LoadMoreButton` / `GET /api/images` / `GET /api/images/random` から profiles の受け渡しを削除し、`listImagesResponseSchema` / `randomImagesResponseSchema` から `profiles` フィールドを削除する

### 2. 画像詳細ページ (`app/(site)/images/[id]/page.tsx`)

新たに投稿者情報行を追加する。

#### 表示形式

```
投稿者： (アバター) (表示名 / GitHub リンク)
```

- 「表示名」をクリックすると GitHub プロフィールに遷移する (`https://github.com/<githubLogin>`、`target="_blank" rel="noopener noreferrer"`)
- 投稿者プロフィールが取得できない場合 (連携解除など) は `Unknown` + デフォルトアバターを表示し、リンクは張らない
- 既存の `src/lib/profile/resolve-uploader-display.ts` を流用する

#### データ取得

- `ImageDetailPage` で `image.uploaderId` を使って `UserProfileService.findById` を呼び出す
- 既存の `Promise.all([imageResult, userResult])` は維持しつつ、画像取得後に `findById(uploaderId)` を 1 回呼ぶ (uploaderId は画像取得後に判明するため逐次)
- プロフィール取得失敗時は `null` にフォールバックし、ページ自体は 200 で表示する

## スコープ

- **対象**:
  - トップページの `ImageCard` の投稿者表示削除
  - 画像詳細ページへの投稿者表示追加
  - 上記に伴う profile 受け渡し経路の整理 (`home-content.tsx` → `HomeImages` → `ImageGrid` → `ImageCard`、および `LoadMoreButton` 経路 / API レスポンス / バリデーションスキーマ)
- **対象外**:
  - お気に入り一覧での投稿者表示
  - プロフィールページの新設
  - 投稿者で絞り込む機能

## 完了条件

- [ ] `components/image-card.tsx` から投稿者アバター + リンクの DOM および `profile` props を削除する
- [ ] `components/image-grid.tsx` / `components/home-images.tsx` / `components/load-more-button.tsx` / `components/home-content.tsx` から profiles の受け渡しを削除する
- [ ] `app/api/images/route.ts` / `app/api/images/random/route.ts` から `profiles` を削除し、`src/lib/validation/image.ts` のレスポンススキーマから `profiles` フィールドを削除する
- [ ] `app/(site)/images/[id]/page.tsx` に「投稿者： アバター 表示名(リンク)」の行を追加する
- [ ] 投稿者プロフィール取得失敗時のフォールバック (`Unknown` + デフォルトアバター、リンクなし) が機能する
- [ ] 既存のテスト (`tests/e2e/image-list.test.ts`、`tests/unit/api/images/list-route.test.ts`、`tests/unit/api/images/random-route.test.ts`、`tests/unit/lib/validation/image.test.ts`) を更新する
- [ ] 詳細ページ用の E2E テスト (`tests/e2e/image-detail.test.ts`) に投稿者行の検証を追加する
- [ ] `npm test`, `npm run lint`, `npm run typecheck` がすべて成功する

## 留意点

- アクセシビリティ:
  - アバターの `alt` は空文字 (装飾) のまま。隣接するテキストリンクで投稿者名を表現する
  - 「投稿者：」というラベルを `<dt>`/`<span>` 等で明示し、視覚的にもセマンティックにも意味が通るようにする
- LCP への影響:
  - 詳細ページではアバター 1 件のみで影響軽微の想定だが、`next/image` の `sizes` 指定を忘れない
  - 詳細ページの LCP は中央の LGTM 画像が候補のため、アバター画像は `priority` を付けない
- N+1 防止:
  - 詳細ページは画像 1 件しか扱わないため `findById` で十分
  - `findManyByIds` を使う必然性はない
- 後方互換性:
  - API レスポンスから `profiles` を削除する破壊的変更だが、本リポジトリ内で消費しているクライアントを同 PR で同時に更新するため許容する
