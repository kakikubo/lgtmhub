# 設計書

## アーキテクチャ概要

既存のレイヤード構成 (Presentation → Service → Repository) に乗せる。
Server Component → Service 直呼び出しの既存パターン (一覧 `app/(site)/page.tsx`) を踏襲し、
新規 API Route は追加しない。

```
[ブラウザ]
   │ GET /images/{id}
   ▼
[app/(site)/images/[id]/page.tsx]  Server Component
   │ params.id を取り出し
   ▼
[ImageService.getImage(id)]
   │
   ▼
[ImageRepository.findActiveById(id)]
   │
   ▼
[Supabase: lgtm_images where id=$ and status='active']
   │
   ▼
[PublicLgtmImage | null]
   │
   ▼ null なら notFound()
[<DetailView />]
   ├─ 画像 (next/image)
   ├─ <CopyMarkdownButton />     ← 既存コンポーネント再利用
   └─ 「← 一覧に戻る」 <Link href="/">
```

## コンポーネント設計

### 1. `app/(site)/images/[id]/page.tsx` (Server Component)

**責務**:
- URL パラメータ `id` を受け取り、`ImageService.getImage` を呼ぶ
- 取得失敗 (DB 障害) を catch し、500 化せずに 404 ページ (`notFound()`) で graceful degrade する
  - 一覧ページ (`HomePage`) が DB 障害時に 500 ではなく `LoadErrorState` を出すのと同じ思想
  - 詳細ページは「個別画像が見えない」ことそのものが本質的な失敗なので、500 / エラー画面より 404 の方が UX 上自然
- `null` の場合は `notFound()` を呼ぶ
- 取得できた `PublicLgtmImage` を `DetailView` (page 内ローカル) に渡す

**実装の要点**:
- `dynamic = 'force-dynamic'` などの強制は不要 (デフォルトで動的レンダリング)。`params` を使うため Static にはならない
- Next.js 15 の `params` は Promise (`{ id: string } | Promise<{ id: string }>`)。`async params` を `await` で受ける既存規約に従う
- `notFound()` は `next/navigation` から import する

### 2. 画像表示部 `<DetailView image={...} />` (page.tsx 内のローカル関数)

**責務**:
- 画像本体と操作 UI を縦並びでレイアウト
- レイアウト幅は一覧と揃えて `max-w-3xl` 程度。一覧の `max-w-6xl` より狭く、画像 1 枚に集中させる

**実装の要点**:
- `next/image` の `fill` ではサイズを固定できないため、詳細ページでは `width` / `height` 指定で実画像比率を保つ
  - DB に `width` / `height` を持っているが、`PublicLgtmImage` には含めていない (一覧ではアスペクト比を `aspect-[4/3]` でクロップしているため不要だった)
  - 詳細ページでは画像の本来比率を維持したい → 本作業で `PublicLgtmImage` に `width` / `height` を追加して伝播させる
  - 内部利用フィールドの公開拡張だが、`pHash` / `fileSizeBytes` 等は引き続き隠す方針 (機能設計書「フィールド絞り込み方針」と矛盾しない範囲)
- `sizes="(min-width: 768px) 768px, 100vw"` で next/image 最適化を効かせる
- `priority` を付けて LCP に効かせる (詳細ページの主要要素)

### 3. `components/image-card.tsx` の改修

**責務 (拡張)**:
- サムネイル領域を `<Link href="/images/{id}">` でラップし、画像クリックで詳細遷移
- マークダウンコピーボタンはリンクの外に置き、リンク誤発火を防ぐ

**実装の要点**:
- 既存テスト `data-testid` (`copy-markdown-button` 等) を壊さない
- 新規 `data-testid="image-card-link"` を `<Link>` に付ける (E2E 用)
- `next/link` のデフォルト `prefetch` のままで OK。Server Component の child でも問題なく利用できる

### 4. `src/services/image-service.ts` の拡張

**追加 API**: `async getImage(id: string): Promise<PublicLgtmImage | null>`

**実装の要点**:
- `imageRepo.findActiveById(id)` をそのまま呼び、既存の `toPublic` で整形する
- 「見つからない」 と「DB エラー」 を区別: 前者は `null`、後者はそのまま throw (Page 側で catch)
- `getImageOrThrow` は今回作らない (404 への変換は Page 側の `notFound()` が直接呼べるため、純粋な「null チェック」を Service に押し込む利益がない)

### 5. `src/repositories/image-repository.ts` の拡張

**追加 API**: `async findActiveById(id: string): Promise<LgtmImage | null>`

**実装の要点**:
- `.eq('id', id).eq('status', 'active').maybeSingle()` を使う
  - `.single()` だと「0 件」もエラー扱いになるため、`maybeSingle()` で「0 件 → null」を素直に返せる
  - `UserProfileRepository.findById` と同じパターン
- `error` がある場合は `DatabaseError` を throw
- 戻り値は既存の `toLgtmImage` で camelCase 化

### 6. `src/types/image.ts` の拡張

`PublicLgtmImage` に `width: number` / `height: number` を追加する。
画像の本来比率を維持して詳細ページで表示するために必要。
内部用途専用フィールド (`pHash` / `fileSizeBytes` / `mimeType` / `originalUrl` / `status` / `deletedAt` / `updatedAt`) は引き続き露出させない。

## データフロー

### 詳細ページ正常表示
```
1. /images/{id} へアクセス
2. Server Component が ImageService.getImage(id) を await
3. Repository が status='active' の画像を取得し、PublicLgtmImage を返す
4. <DetailView image={...} /> をレンダリング
```

### 存在しない / 削除済み
```
1. ImageRepository.findActiveById が null を返す (status='deleted' は eq('status','active') で除外)
2. ImageService.getImage が null を返す
3. Page で notFound() → Next.js 標準 404 ページへ
```

### DB 障害
```
1. Repository が DatabaseError を throw
2. Page が catch して notFound() を呼ぶ (一覧ページの graceful degrade と同方針)
3. console.error でログ出力
```

## エラーハンドリング戦略

### カスタムエラークラス
新設なし。既存 `DatabaseError` を再利用する。
詳細ページからは domain 例外を直接 UI に伝えず、Page 内で `notFound()` に変換する。

### エラーハンドリングパターン

| 発生場所 | 例外 | UI への変換 |
|----------|------|-------------|
| Repository | `DatabaseError` | Page で catch → `notFound()` |
| Service | (例外をそのまま throw) | 同上 |
| Page | `null` 受領 | `notFound()` |

`notFound()` は throw ベースで動くため、catch の後にもう一度呼んで OK (try / catch の「正常系扱い」になる)。

## テスト戦略

### ユニットテスト

- `tests/unit/repositories/image-repository.test.ts` に `findActiveById` の追加ケース
  - `data` あり → camelCase 化された `LgtmImage` が返る
  - `data` null → `null` が返る (= maybeSingle の「0 件」分岐)
  - `error` あり → `DatabaseError` を throw

- `tests/unit/services/image-service.test.ts` に `getImage` の追加ケース
  - Repository が `LgtmImage` を返す → `PublicLgtmImage` (width/height 付き) を返す
  - Repository が `null` を返す → `null` を返す
  - Repository が throw → そのまま伝播 (Page が catch する責務)

### E2E テスト (Playwright)

`tests/e2e/image-detail.test.ts` を新設:
- 一覧ページから先頭サムネイルをクリックすると `/images/{uuid}` へ遷移する
  (= ImageGrid の最初のリンクを取って goto を確認)
- 一覧が空 (= 開発初期 / CI placeholder env) の場合はテストをスキップする
  - `getByTestId('image-list-empty')` が見えていれば skip
  - 既存 `image-list.test.ts` がデータ有無に依存しない書き方をしているのと同じ方針
- 不正な UUID (`/images/00000000-0000-0000-0000-000000000000`) で 404 ページが見える
  - `await expect(page.getByText(/404|見つかりません/)).toBeVisible()` 程度の弱い検証で十分
  - Next.js のデフォルト notFound 出力に依存しない (`not-found.tsx` は本作業で追加しない)

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
app/(site)/images/[id]/page.tsx          (新規)
components/image-card.tsx                (改修: <Link> 追加)
src/services/image-service.ts            (拡張: getImage)
src/repositories/image-repository.ts     (拡張: findActiveById)
src/types/image.ts                       (拡張: PublicLgtmImage に width/height)
tests/unit/repositories/image-repository.test.ts  (テスト追加)
tests/unit/services/image-service.test.ts         (テスト追加)
tests/e2e/image-detail.test.ts           (新規)
```

## 実装の順序

1. `src/types/image.ts` の `PublicLgtmImage` 拡張 (width/height)
2. `src/services/image-service.ts` の `toPublic` 修正と `listImages` テスト整合
3. `src/repositories/image-repository.ts` に `findActiveById` を追加 + 単体テスト
4. `src/services/image-service.ts` に `getImage` を追加 + 単体テスト
5. `app/(site)/images/[id]/page.tsx` を新規作成
6. `components/image-card.tsx` を改修してサムネイルを `<Link>` で包む
7. `tests/e2e/image-detail.test.ts` を新規作成
8. `npm run lint` / `typecheck` / `test` を順に通す

## セキュリティ考慮事項

- 詳細ページ閲覧はログイン不要 (PRD 機能 5 と同じ)
- RLS ポリシー「`anyone can view active images`」が status='active' のみを返すため、`status='deleted'` を Service 経由で見ることもできない
  - Repository 側でも `eq('status', 'active')` を明示し、二重防御にする
- `params.id` は zod 検証しないが、Supabase の UUID 列にそのまま渡る不正値は SQL レベルで `null` 0 件扱いになる → 結果的に 404 化される
  - 万一 SQL エラーになる場合 (UUID パース失敗) は `DatabaseError` で吸収 → Page で `notFound()`

## パフォーマンス考慮事項

- 詳細ページの LCP 目標は 2 秒 (PRD 非機能要件)
- 画像に `priority` を付け、`next/image` の最適化と画像 CDN (Vercel Blob) の組み合わせで初期描画を高速化
- DB クエリは PK + status の複合検索で 1 行取得のため、追加インデックスは不要
  (既存 `lgtm_images_status_created_at_idx` は一覧用。PK 索引が UUID 検索に効く)

## 将来の拡張性

- 後続 PR で詳細ページに以下が足される:
  - 削除ボタン (P0 #2): ログイン済み + 自分の画像のときに表示
  - お気に入りボタン (P0 #4-A): ログイン済みユーザー全員に表示
  - 投稿者プロフィール表示 (将来)
- 詳細ページが Server Component なので、上記をログイン状態 / オーナー判定で条件レンダリングするのが容易
