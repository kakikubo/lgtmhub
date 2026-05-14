# requirements.md

## Issue

- [#102 画像カード投稿者プロフィールに GitHub リンクを追加](https://github.com/kakikubo/lgtmhub/issues/102)

## 背景

Issue #98 で画像一覧の `ImageCard` に投稿者プロフィール（アバター / 表示名）を表示できるようになった。
ただし投稿者ブロックには遷移先が無く、投稿者がどんな人物かを確認する手段が無い。

## 目的

画像一覧の各画像カードに表示されている投稿者ブロック（アバター + 表示名）をクリック可能にし、
その投稿者の GitHub プロフィールページへ遷移できるようにする。

## スコープ

### 対象

- `src/lib/profile/resolve-uploader-display.ts`: 戻り値に `profileUrl` を追加
- `components/image-card.tsx`: 投稿者ブロックを `<a>` でラップ（`profileUrl` が undefined のときは従来通り `<div>`）
- `tests/unit/lib/profile/resolve-uploader-display.test.ts`: `profileUrl` 検証ケースを追加
- `tests/e2e/image-list.test.ts`: 投稿者ブロックの `<a>` 属性 / fallback 時の非リンク化を検証

### 対象外

- 画像詳細ページ（`app/(site)/images/[id]/page.tsx`）には投稿者表示が無いため非対応
- `LoadMoreButton` 経由の追加読み込み分のリンク化は別 PR / Issue で扱う（本 Issue は初期表示分のみ）

## 機能要件

### リンク範囲

- アバター画像と表示名を **1 つの `<a>` でラップ** し、ブロック全体をクリック領域にする。

### リンク先

- `https://github.com/{profile.githubLogin}` へ遷移する。
- 遷移は **新規タブ**（`target="_blank"` + `rel="noopener noreferrer"`）。

### Fallback（プロフィール未取得）時の挙動

- `resolveUploaderDisplay` の `isFallback === true` のときは **リンクにせず**、従来通りプレーンな `<div>` で表示する（`Unknown` で GitHub へ飛ばさない）。

### URL 組み立て

- `resolveUploaderDisplay` の戻り値に `profileUrl: string | undefined` フィールドを追加する。
  - profile があるとき: `https://github.com/{githubLogin}`
  - fallback のとき: `undefined`
- `ImageCard` 側は `profileUrl` の有無で `<a>` を出すか `<div>` を出すかを分岐する。

### 視覚的フィードバック

- 表示名（`<span>`）に `hover:underline` を付与し、ホバー時にアンダーラインを表示する。
- アバターには装飾を加えない。
- フォーカスリングは `<a>` のデフォルトに任せる。

### アクセシビリティ

- `<a>` に `aria-label="{displayName} の GitHub プロフィール"` を付与する。
- アバター画像の `alt` を空文字 (`alt=""`) にして装飾画像扱いとし、displayName が二重に読み上げられないようにする。

## 受け入れ条件

- [ ] 画像一覧画面で、投稿者プロフィールがあるカードはアバター + 表示名のブロックがリンクになっている
- [ ] そのリンクをクリックすると新規タブで `https://github.com/{githubLogin}` が開く
- [ ] 投稿者プロフィールが取得できないカード（fallback）はリンクになっていない
- [ ] 表示名ホバー時にアンダーラインが表示される
- [ ] スクリーンリーダーで `"{displayName} の GitHub プロフィール"` と読み上げられる
