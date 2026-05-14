# design.md

## 全体方針

Issue #98 で導入した `resolveUploaderDisplay` の戻り値を 1 フィールド (`profileUrl`) 拡張し、
`ImageCard` 側のレンダリング分岐をその有無で行う。
構成（純関数 + プレゼンテーション）を維持し、追加のサービス層・データ取得は発生しない。

## 変更ファイルとその責務

### `src/lib/profile/resolve-uploader-display.ts`

- `UploaderDisplay` インターフェイスに `profileUrl: string | undefined` を追加する。
- `GITHUB_PROFILE_BASE_URL` 定数 (`'https://github.com/'`) を導入し、URL 組み立てを 1 箇所に集約する。
- profile があるとき: `profileUrl = GITHUB_PROFILE_BASE_URL + profile.githubLogin`。
- profile が undefined のとき: `profileUrl = undefined`（`isFallback === true` と等価）。
- `githubLogin` は GitHub の認証フローで取得した値であり、ユーザー入力で書き換わらない前提（型保証）なので URL エンコードは行わない。

### `components/image-card.tsx`

- 既存の `<div data-testid="image-card-uploader">` のラッパー要素を、`uploader.profileUrl` の有無で分岐する。
  - `profileUrl` が文字列のとき: `<a href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label={`${displayName} の GitHub プロフィール`}>`
  - `undefined` のとき: 従来どおり `<div>`（属性は最小化）
- どちらの分岐でも `data-testid="image-card-uploader"` / `data-fallback` 属性を維持する（E2E の既存検証と互換）。
- `<Image alt>` を `""` に変更し、装飾画像扱いとする。displayName は `<span>` 側で読み上げに任せる。
- 表示名 `<span>` には `group-hover:underline` を付与し、リンク (`<a>`) ホバー時のみアンダーラインを表示する。`hover:underline` は使わない（fallback の `<div>` 内 `<span>` でも発火してしまうため）。アバターには装飾を追加しない。
- `<a>` の Tailwind クラスは `flex items-center gap-2` をそのまま継承し、`group` を加えて子要素の `group-hover` 装飾を発火させる。フォーカスリングは既存の画像リンクと同等に `focus:outline-none focus:ring-2 focus:ring-gray-900 rounded` を付与。

#### 分岐の実装パターン

冗長な早期 return / 三項ネストを避けるため、共通の子ノード（アバター + 表示名）を 1 つの JSX フラグメント変数に切り出し、ラッパー側だけを分岐する。

```tsx
const uploaderContent = (
  <>
    <Image src={uploader.avatarUrl} alt="" width={24} height={24} ... />
    <span className="text-sm text-gray-700 truncate group-hover:underline">
      {uploader.displayName}
    </span>
  </>
);

return uploader.profileUrl ? (
  <a
    href={uploader.profileUrl}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`${uploader.displayName} の GitHub プロフィール`}
    data-testid="image-card-uploader"
    data-fallback="false"
    className="group flex items-center gap-2 rounded focus:outline-none focus:ring-2 focus:ring-gray-900"
  >
    {uploaderContent}
  </a>
) : (
  <div
    data-testid="image-card-uploader"
    data-fallback="true"
    className="flex items-center gap-2"
  >
    {uploaderContent}
  </div>
);
```

### `tests/unit/lib/profile/resolve-uploader-display.test.ts`

- 既存 2 ケースの期待値に `profileUrl` を追加する。
- profile あり: `profileUrl: 'https://github.com/{githubLogin}'`
- profile なし: `profileUrl: undefined`

### `tests/e2e/image-list.test.ts`

- 既存「画像がある場合、各カードに投稿者プロフィール行が表示される」テストの後ろに、新規 test を追加する。
- 検証ポイント:
  - `[data-testid="image-card-uploader"][data-fallback="false"]` の最初の要素が `a` であること。
  - その `a` の `href` が `https://github.com/` で始まり、`githubLogin` 部分が非空。
  - その `a` の `target` が `_blank`、`rel` に `noopener` と `noreferrer` が含まれる。
  - `[data-testid="image-card-uploader"][data-fallback="true"]` が存在する場合、それは `a` ではなく `div`。

E2E 環境にデータが無いケースをハンドリングするため、既存の「グリッド未表示はスキップ」ガードと同様、`data-fallback="false"` カードが 0 件のときはサブテストをスキップする。

## 非機能の考慮

### セキュリティ

- `target="_blank"` には必ず `rel="noopener noreferrer"` を併記し、tabnapping を防止する。
- `githubLogin` は GitHub OAuth で取得した値であり、`UserProfile` 型で文字列保証されているためテンプレートリテラル合成で十分。

### アクセシビリティ

- `aria-label` を `<a>` 側に設けることで、リンク要素全体の意味を明示する。
- アバター画像 `alt` を空にして装飾画像扱いとし、リンクテキスト（displayName）と二重読み上げにならないようにする。

### パフォーマンス

- 追加のサーバ呼び出し・SQL 発行なし。`resolveUploaderDisplay` 内の文字列結合のみ。
- `ImageCard` のレンダリングは Server Component のままで、追加のクライアントランタイムは持ち込まない。

## テスト戦略

- **単体テスト**: `resolveUploaderDisplay` の `profileUrl` 戻り値（profile あり / undefined）。
- **E2E**: `tests/e2e/image-list.test.ts` で `<a>` 属性および fallback 時の非リンク化を検証。
- **コンポーネント単体テスト**: 現状 RTL/jsdom は未導入のため、E2E で代替する（Issue #98 の判断を踏襲）。

## ロールバック方針

- 単一コミット / 単一 PR で完結する。
- リバート時は `resolve-uploader-display.ts` の `profileUrl` 追加と `image-card.tsx` の `<a>` ラップを同時に戻すだけで Issue #98 直後の状態に戻る。
