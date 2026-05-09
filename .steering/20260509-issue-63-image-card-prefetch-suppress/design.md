# 設計: ImageCard の Link prefetch 抑制

## アプローチ選定

Issue で提示された 3 案のうち、**案 A: `prefetch={false}` を直接設定** を採用する。

| 案 | メリット | デメリット | 採用可否 |
|---|---|---|---|
| A. `<Link prefetch={false}>` | 1 行で完了。最も保守的。Next.js 標準 API。`<LoadMoreButton>` 経由で追加されたカードにも自動適用 | クリックまで遷移キャッシュなし。詳細ページ LCP が +100〜200ms 程度悪化する可能性 | ✅ 採用 |
| B. 自前 IntersectionObserver で hover/focus 時のみ fetch | 体感遷移速度を維持しつつ初回ロード負荷を回避できる | 実装が複雑化し、画像カードに状態管理を持ち込む。テストもブラウザ挙動依存で書きづらい | ❌ 不採用 (将来検討) |
| C. `prefetch="hover"` 相当の制御 | 案 B のサブセット | Next.js 15 に明示 API なし、結果的に案 B と同じ実装コスト | ❌ 不採用 |

## 実装方針

### Next.js 15 における `prefetch` プロパティの挙動

Next.js 15.5 (本プロジェクトで使用中の `~15.5.15`) の `<Link>`:

- `prefetch` 未指定 (default): production ビルドではビューポートに入った時点で RSC ペイロード (`?_rsc=...`) を自動プリフェッチする
- `prefetch={false}`: ビューポート入りでの自動プリフェッチを行わず、クリック時に初めてナビゲーションが発生する
- `prefetch={true}`: マウント時にプリフェッチを開始する

本対応では `prefetch={false}` を採用し、初回ロード時のネットワーク負荷を抑制する。

### 変更箇所

**`components/image-card.tsx:14-19`**

```diff
       <Link
         href={`/images/${image.id}`}
         data-testid="image-card-link"
         className="block focus:outline-none focus:ring-2 focus:ring-gray-900 rounded"
+        prefetch={false}
       >
```

`ImageCard` コンポーネントで一元的に prefetch 制御を行うため、`<ImageGrid>` (初回 SSR で表示されるカード) も `<LoadMoreButton>` (クライアント側で追加されるカード) も自動的に同じ抑制が適用される。

### 検証戦略

#### DOM レベルの自動検証 (E2E)

`tests/e2e/image-list.test.ts` に新規アサーションを追加:

- `image-card-link` の `<a>` 要素から、`prefetch={false}` を反映する DOM 属性を検証する
- Next.js 15 の `<Link prefetch={false}>` がレンダリングする `<a>` には特別な属性が付かないため、**E2E 観点ではネットワークレベルでの検証 (page.on('request') で `?_rsc=` を含むリクエストが発火しないこと) を採用する**

具体的には、Playwright の `page.on('request')` で `?_rsc=` を含むリクエストをリッスンし、トップページ表示後の一定時間内に発火していないことを assert する。

#### 手動検証

ローカル `npm run build && npm run start` で起動し、Chrome DevTools の Network タブで:

1. `?_rsc=` を含むリクエスト数が 0 本であることを確認
2. カードクリックで詳細ページに遷移し、その時点で初めて `?_rsc=` または `/images/<id>` 直接ナビゲーションが発生することを確認
3. Performance trace を記録し、TBT が改善前と比較して短縮していることを確認 (定量数値は PR description に記載)

### リスクと対策

| リスク | 影響 | 対策 |
|---|---|---|
| `prefetch={false}` 設定後も Next.js が hover 時にプリフェッチする可能性 | 改善効果が限定的 | E2E でネットワーク観測し、初回ロード後 1 秒間は `?_rsc=` が 0 本であることを確認。hover 時の挙動は本 Issue のスコープ外 |
| 詳細ページ遷移 LCP の悪化 | UX 体感悪化 | PR description でトレードオフを明記。Issue の「+200ms 以内」許容範囲を逸脱した場合は案 B (IntersectionObserver) への移行を検討 |
| `<LoadMoreButton>` で追加されたカードに抑制が効かない | 改善効果が初回カードのみに限定 | `ImageCard` コンポーネントで一元制御するため、`LoadMoreButton` 側の変更は不要 (構造的に同じ抑制が適用される) |

## 既存パターンとの整合性

- `image-card.tsx` は既に `priority?: boolean` を `props` で受け取り `<Image>` に流す既存パターンがある (2026-05-06 LCP 対応)。今回の `prefetch={false}` は `<Link>` に対する**固定値**でありプロパティ化しないが、将来的にホーム以外で本コンポーネントを再利用する場合に備えて prop 化を検討する余地あり (本 PR ではスコープ外)。
- E2E のネットワーク観測パターンは本リポジトリで初導入。`tests/e2e/image-list.test.ts` 内に追加することで、画像一覧画面に関する非機能要件の検証ハブとして集約する。
