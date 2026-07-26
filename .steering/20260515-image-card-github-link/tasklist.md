# tasklist.md

## タスク一覧

- [x] T1 `src/lib/profile/resolve-uploader-display.ts` に `profileUrl: string | undefined` と `GITHUB_PROFILE_BASE_URL` 定数を追加
- [x] T2 `tests/unit/lib/profile/resolve-uploader-display.test.ts` を更新（`profileUrl` の期待値を追加）
- [x] T3 `components/image-card.tsx` の投稿者ブロックを `profileUrl` で `<a>` / `<div>` 分岐実装（`target` / `rel` / `aria-label` / `alt=""` / `hover:underline`）
- [x] T4 `tests/e2e/image-list.test.ts` に投稿者リンクの属性検証 + fallback 時の非リンク化検証を追加
- [x] T5 `npx vitest run` / `npx biome lint .` / `npx tsc --noEmit` を実行しグリーン確認

## 申し送り事項

### 実装完了日
2026-05-15

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| 表示名のホバー装飾 | `<span>` に `hover:underline` を付与 | `group-hover:underline` に変更し、`<a>` 側に `group` クラスを追加。`uploaderInner` を `<a>` と `<div>` で共有しているため、`hover:underline` のままだと fallback (`<div>`) 内の `<span>` でもアンダーラインが発火し「クリック不可なのに反応する」UX になる。`group-hover` パターンで `<a>` ラッパー側のホバー時のみアンダーラインが出るように修正 (implementation-validator の指摘) |
| E2E `aria-label` のアサーション | `/ の GitHub プロフィール$/` の suffix チェック | `/^.+ の GitHub プロフィール$/` に強化。displayName 部分が非空であることまで保証 (implementation-validator の指摘) |

### 学んだこと

1. **共有フラグメント + `group-hover` パターン**: `<a>` と `<div>` で同じ子ノードを共有しつつ「ラッパー要素ごとにホバー挙動を切り替える」用途には Tailwind の `group` / `group-hover:` が綺麗にハマる。子ノード側に `hover:` を書くと両方のラッパーで発火してしまうので、リンクのときだけホバースタイルを出したいケースでは `group-hover:` 一択。
2. **URL 組み立てを `resolveUploaderDisplay` 内に閉じる**: `ImageCard` 側で `https://github.com/${profile?.githubLogin}` を組み立てると、ImageCard が「fallback 判定 + URL 組み立て」の 2 つの関心事を持つことになる。`profileUrl` を `UploaderDisplay` の戻り値に含めることで `ImageCard` 側のレンダリング分岐が単純な truthy チェックだけになり、テストもユニット側に寄せやすい。
3. **`alt=""` と `aria-label` の組み合わせ**: アバター画像 + 表示名のように「装飾画像 + テキスト」の構造でリンク化する場合、画像 `alt` を空文字 (装飾扱い) にしておかないとスクリーンリーダーで displayName が二重に読み上げられる。`aria-label` でリンク全体の意味を上書きするのが標準パターン。

### 次回への改善提案

1. **`LoadMoreButton` 経由の追加読み込みでも投稿者リンクを表示する (別 Issue)**:
   - Issue #98 と同じく、初期表示分のみ対応。追加読み込み分は別 Issue で `LoadMoreButton` の Server Action 側に `findManyByIds` を組み込む必要がある。
2. **画像詳細ページでの投稿者表示 (別 Issue)**:
   - 詳細ページ自体に投稿者表示が未実装。導入時に同じ `resolveUploaderDisplay` + `profileUrl` パターンで一貫させる。
3. **`<a>` の `data-testid` 重複問題**:
   - `image-card-uploader` testid は `<a>` と `<div>` の両ケースで付与しているが、テスト側で要素種別を区別したいケースが増えたら `data-fallback` 属性ベースのセレクタ (`[data-fallback="false"]` / `[data-fallback="true"]`) に明示的に寄せる方が安全。今回の E2E はすでにこの形に揃えた。
