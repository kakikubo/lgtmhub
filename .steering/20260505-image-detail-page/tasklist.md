# タスクリスト: 画像詳細ページ (`/images/[id]`)

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: 型と Repository

- [x] T1-1 `src/types/image.ts` の `PublicLgtmImage` に `width: number` / `height: number` を追加
- [x] T1-2 `src/services/image-service.ts` の `toPublic` で `width` / `height` を含めて返すよう修正 (既存 `listImages` テストへの波及あり)
- [x] T1-3 `src/repositories/image-repository.ts` に `async findActiveById(id: string): Promise<LgtmImage | null>` を追加
  - `.eq('id', id).eq('status', 'active').maybeSingle()` を利用
  - `error` がある場合は `DatabaseError` を throw
  - 戻り値は既存 `toLgtmImage` で camelCase 化

## フェーズ 2: Service

- [x] T2-1 `src/services/image-service.ts` に `async getImage(id: string): Promise<PublicLgtmImage | null>` を追加
  - `imageRepo.findActiveById(id)` を呼び、`null` ならそのまま `null` を返す
  - 取得できれば `toPublic` で整形して返す

## フェーズ 3: Presentation Layer

- [x] T3-1 `app/(site)/images/[id]/page.tsx` を新規作成
  - Server Component。`params: Promise<{ id: string }>` を `await` で受ける
  - `try { ... } catch` で `DatabaseError` を捕捉し、`console.error` してから `notFound()` を呼ぶ
  - Service が `null` を返したら `notFound()`
  - 取得できたら page 内ローカル `<DetailView image={...} />` をレンダリング
- [x] T3-2 `<DetailView />` の中で「← 一覧に戻る」 `<Link href="/">` と `<Image>` (実画像比率, `priority`) と `<CopyMarkdownButton />` を配置
- [x] T3-3 `data-testid` を整備
  - `image-detail-page` (section root)
  - `image-detail-back-link`
  - `image-detail-image` (`<Image>` を包む `<div>` に付与)
- [x] T3-4 `components/image-card.tsx` を改修し、サムネイル領域を `<Link href={\`/images/${image.id}\`}>` で包む
  - リンクに `data-testid="image-card-link"` を付与
  - `<CopyMarkdownButton />` はリンクの外に置く (Enter / クリック衝突を避ける)

## フェーズ 4: ユニットテスト

- [x] T4-1 `tests/unit/repositories/image-repository.test.ts` に `findActiveById` のテストを追加
  - data あり → camelCase 化された `LgtmImage` を返す
  - data null → `null` を返す
  - error → `DatabaseError` を throw
- [x] T4-2 `tests/unit/services/image-service.test.ts` に `getImage` のテストを追加
  - Repository が `LgtmImage` を返す → `width` / `height` 付きの `PublicLgtmImage` を返す
  - Repository が `null` → `null` を返す
  - Repository が throw → そのまま伝播する
- [x] T4-3 `listImages` テストの期待値に `width` / `height` を追加 (T1-2 の波及)

## フェーズ 5: E2E テスト

- [x] T5-1 `tests/e2e/image-detail.test.ts` を新規作成
  - 「一覧から先頭リンクをクリックすると `/images/{uuid}` に遷移する。一覧が空ならスキップ」
  - 「不正な UUID で 404 ページが表示される (Next.js デフォルト 404)」

## フェーズ 6: 品質チェック

- [x] T6-1 `npm run lint` がエラー無しで通る
- [x] T6-2 `npm run typecheck` がエラー無しで通る
- [x] T6-3 `npm test` が pass する (カバレッジ閾値含む)

## フェーズ 7: 実装検証

- [x] T7-1 `implementation-validator` サブエージェントで全実装を検証し、指摘があれば解消する

## フェーズ 8: 振り返り

- [x] T8-1 本ファイル末尾の「実装後の振り返り」を更新
  - 実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案
- [x] T8-2 永続ドキュメント (`docs/`) で更新が必要な箇所があるか判断し、必要なら更新する

---

## 実装後の振り返り

### 実装完了日
2026-05-05

### 実装サマリー

PRD P0 #2 (削除) と #4-A (お気に入り) の入口になる「画像詳細ページ `/images/[id]`」を MVP として新設した。
詳細ページに削除/お気に入りなど操作系 UI はまだ載せず、「他の P0 機能を実装可能にする土台」として位置付けて最小スコープに絞った。

- **新規ページ**: `app/(site)/images/[id]/page.tsx` (Server Component, `notFound()` で 404 graceful degrade)
- **新規 E2E**: `tests/e2e/image-detail.test.ts` (一覧 → 詳細遷移 / 不正 UUID → 404)
- **ドメイン拡張**: `ImageRepository.findActiveById` / `ImageService.getImage` を追加
- **型拡張**: `PublicLgtmImage` に `width` / `height` を追加し、詳細ページで実画像比率を維持
- **一覧 → 詳細導線**: `components/image-card.tsx` を `<Link>` でラップ
- **API スキーマ整合**: `listImagesResponseSchema` / `LoadMoreButton` も width/height に対応
- **ドキュメント更新**: `docs/functional-design.md` の「フィールド絞り込み方針」を更新 (`width` / `height` を公開フィールドに昇格)

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| `PublicLgtmImage` の拡張範囲 | `width` / `height` を Service の `toPublic` に追加 | API 経由でクライアントに渡るには `listImagesResponseSchema` (zod) と `LoadMoreButton` の写像も同時更新が必要だった。型 → スキーマ → 写像の 3 点セットで漏れなく同期した |
| `listImagesResponseSchema` のテスト | 計画に明記せず | `width` / `height` 必須テストを追加 (T4-3 の延長) |
| `docs/functional-design.md` の更新 | T8-2 で「必要なら」とだけ書いていた | `pHash` / `width` / `height` / `fileSizeBytes` を「内部用途専用」と明記してあったため、`width` / `height` を例外として独立行に分離して更新した |

### 学んだこと

**技術的な学び**:
1. **「型を 1 つ広げる」 = 「3 箇所同時に広げる」**: `PublicLgtmImage` のような DTO 型を変更すると、TypeScript 型 + zod レスポンススキーマ + クライアント側の `JSON → DTO` 写像の 3 点を必ず同時に更新する必要がある。型エラーは最初の 2 点までしか検出してくれない (zod parse は実行時、DTO は any の握り潰しで気付けない場合あり)。今回は `LoadMoreButton` で型注釈と writable の両方が出ていたため気付けた
2. **Server Component から Service 直呼びは graceful degrade と相性が良い**: 一覧 (`HomePage`) と詳細 (`ImageDetailPage`) で「DB エラー時に 500 化させない」という共通方針を採れる。詳細ページでは「個別画像が見えない」ことが本質的な失敗なので 404 化が UX 上自然で、Service の throw を `notFound()` に倒すだけで済む
3. **`maybeSingle()` の選択は「0 件 = エラーじゃない」を明示する**: `single()` だと 0 件で error が返り、Repository 側で「PGRST116 を判別」のような分岐が必要になる。`UserProfileRepository.findById` と同じパターンで `maybeSingle()` を採用するだけで `null` を素直に返せる
4. **`<form>` 内 `<a>` の罠は今回該当しない**: `image-card.tsx` の `<Link>` 化は `<form>` 外で行うのでエンター衝突は発生しない。ただし「リンク内にボタンを置かない」ルールは引き続き有効で、今回は `<CopyMarkdownButton>` を `<Link>` の外に置いている (アクセシビリティ配慮)
5. **チェーン mock は spy 名で順序まで検証できる**: `createMaybeSingleStub` で `eqId` / `eqStatus` を別 spy として持たせ、`from('lgtm_images').select('*').eq('id', x).eq('status', 'active').maybeSingle()` のチェーン順序まで assert できる。これで「`eq('status','active')` を書き忘れて全 status を返す」事故を Unit テストで弾ける

**プロセス上の改善点**:
1. **計画段階で「波及範囲」を tasklist にエントリ化する**: 「PublicLgtmImage に width/height 追加」だけでなく、「listImagesResponseSchema 更新」「LoadMoreButton 写像更新」「validation テストの期待値更新」も最初からタスク化しておくと、実装中に「あれもやらないと」が出ない。今回は実装途中で気付いて追加できたが、リスト整備の段階で見えていれば見積もり精度が上がる
2. **永続ドキュメントへの波及を T8 で機械的に判定する仕組み**: 「DTO のフィールドが増えた」「API レスポンス形式が変わった」のときは `docs/functional-design.md` の影響を必ず確認する、というチェックリストを T8-2 に書いておけば判断の見落としが減る

### 次回への改善提案

1. **詳細ページに削除ボタンを乗せる (P0 #2 別 PR)**
   - 詳細ページが本 PR で公開されたので、ログイン済み + オーナー判定で `<DeleteButton>` を出す導線が確保できた
   - DELETE /api/images/:id (route handler) を新設し、Service 側に `deleteImage(actorId, imageId)` を実装する
   - 論理削除 (`status='deleted'` + `deleted_at` セット) のみで Blob は残置 (PRD 機能 8 で 30 日後物理削除)

2. **詳細ページにお気に入りボタンを乗せる (P0 #4-A 別 PR)**
   - 詳細ページ + 一覧カードの両方に `<FavoriteButton>` を出す
   - `favorites` テーブルがまだマイグレーションに無いので、(マイグレーション + Repository + Service + API + UI) を 1 PR で出すのが筋
   - お気に入り一覧画面 (P0 #4-B) はさらに別 PR

3. **登録フォームの 409 既存画像リンク化 (`components/image-register-form.tsx` 別 PR)**
   - 詳細ページ URL が固まったので、既存の `mapped.existingImageId` を `<Link href="/images/{id}">既存画像を見る</Link>` に繋ぐ。前回ステアリング (`20260504-image-registration-form-ui` 改善提案 #1) の宿題消化

4. **詳細ページのカスタム 404 (任意)**
   - 現状は Next.js デフォルト 404 (英語)。日本語 UI に揃えるなら `app/(site)/images/[id]/not-found.tsx` を追加する。ただし MVP 範囲外。`/images/new` で未ログインなら `/?auth_error=login_required` に倒す方針と整合させて、エラー導線をまとめて整備する PR で扱う

5. **詳細ページの LCP 計測**
   - PRD 非機能要件「画像詳細ページ初期表示 2 秒以内」を Vercel Analytics で実測する。MVP では計測のみ、超過したら `next/image` の `quality` / `placeholder=blur` を検討
   - `priority` を付けたので一旦は問題ないはず

### 今回スコープ外として残したもの

- 削除ボタン / 削除 API (P0 #2 — 別 PR)
- お気に入りボタン / お気に入り API / favorites マイグレーション (P0 #4-A — 別 PR)
- お気に入り一覧画面 (P0 #4-B — 別 PR)
- 登録フォームの 409 既存画像リンク化 (別 PR)
- 投稿者の表示名・アバター表示 (MVP 範囲外)
- カスタム 404 ページ (任意)
- `GET /api/images/:id` Route Handler (現状は Server Component から Service 直呼びで充足。外部需要が出たら別 PR)
- 詳細ページからの SNS シェア / OGP (PRD スコープ外)
