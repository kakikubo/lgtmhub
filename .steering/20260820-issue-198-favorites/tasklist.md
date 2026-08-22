# タスクリスト

Issue: [#198 LGTM画像のお気に入り機能を追加する](https://github.com/kakikubo/lgtmhub/issues/198)

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: DB スキーマ（PR1 バックエンド）

- [x] `supabase/migrations/20260820000000_create_favorites.sql` を作成
  - [x] テーブル定義（id / user_id / lgtm_image_id / created_at）と UNIQUE 制約
  - [x] 一覧用インデックス `(user_id, created_at desc)`
  - [x] RLS 有効化 + SELECT / INSERT / DELETE ポリシー
  - [x] カラム単位 GRANT による最小権限化
- [x] `pnpm run db:reset` でローカルに適用し、エラーが出ないことを確認
- [x] `pnpm run db:types` で `src/types/database.types.ts` を再生成し `favorites` が含まれることを確認

## フェーズ2: ドメイン型・バリデーション・エラー（PR1）

- [x] `src/types/favorite.ts` を作成（`Favorite` インターフェース）
- [x] `src/lib/errors.ts` に `DuplicateFavoriteError` を追加
- [x] `src/lib/validation/favorite.ts` を作成
  - [x] `createFavoriteRequestSchema` / `favoriteImageIdParamSchema`
  - [x] `listFavoritesQuerySchema` と `LIST_FAVORITES_DEFAULT_LIMIT` / `LIST_FAVORITES_MAX_LIMIT`
  - [x] `createFavoriteResponseSchema` / `listFavoritesResponseSchema` / `favoriteImageIdsResponseSchema`
- [x] `tests/unit/lib/validation/favorite.test.ts` を作成して通す
- [x] `tests/unit/lib/errors.test.ts` に `DuplicateFavoriteError` のケースを追加

## フェーズ3: Repository（PR1）

- [x] `src/repositories/favorite-repository.ts` を作成
  - [x] `create` — UNIQUE 違反 (23505) → `DuplicateFavoriteError`、FK 違反 (23503) → `NotFoundError`
  - [x] `delete` — 削除行数を返す
  - [x] `listWithImages` — `lgtm_images!inner` で active のみ JOIN、`created_at desc` + cursor
  - [x] `listImageIds` — 自分のお気に入り画像 ID 一覧
- [x] `tests/unit/repositories/favorite-repository.test.ts` を作成して通す

## フェーズ4: Service（PR1）

- [x] `src/services/favorite-service.ts` を作成
  - [x] `addFavorite` — 画像の存在確認 → create
  - [x] `removeFavorite` — 0 行なら `NotFoundError`
  - [x] `listFavorites` — nextCursor 計算
  - [x] `listFavoriteImageIds`
  - [x] `buildFavoriteService(supabase)` ファクトリ
- [x] `tests/unit/services/favorite-service.test.ts` を作成して通す

## フェーズ5: Route Handler（PR1）

- [x] `app/api/favorites/route.ts` を作成（POST / GET）
- [x] `app/api/favorites/[lgtmImageId]/route.ts` を作成（DELETE）
- [x] `app/api/favorites/ids/route.ts` を作成（GET）
- [x] `app/api/favorites/.gitkeep` を削除
- [x] `tests/unit/api/favorites/create-route.test.ts` を作成して通す
- [x] `tests/unit/api/favorites/list-route.test.ts` を作成して通す
- [x] `tests/unit/api/favorites/delete-route.test.ts` を作成して通す
- [x] `tests/unit/api/favorites/ids-route.test.ts` を作成して通す

## フェーズ6: お気に入りトグル UI（PR2 フロントエンド）

- [x] `components/favorite-provider.tsx` を作成
  - [x] マウント時に `/api/favorites/ids` を取得（401 は未ログインとして扱う）
  - [x] オプティミスティック更新 + ロールバック
  - [x] 最小トースト（live region）の描画
  - [x] 未ログイン時に `signInWithGithub()` を呼ぶ
- [x] `components/favorite-button.tsx` を作成（icon / text の 2 variant）
- [x] `app/(site)/layout.tsx` で `FavoriteProvider` を適用
- [x] `components/image-card.tsx` にハート（icon variant）を追加
- [x] `app/(site)/images/[id]/page.tsx` にハート（text variant）を追加
- [x] `tests/unit/components/favorite-provider.test.tsx` を作成して通す
- [x] `tests/unit/components/favorite-button.test.tsx` を作成して通す
- [x] `tests/unit/components/image-card.test.tsx` にハート描画のケースを追加

## フェーズ7: お気に入り一覧ページと導線（PR2）

- [x] `components/load-more-button.tsx` に `endpoint` / レスポンススキーマの切り替えを追加
- [x] `components/favorite-images.tsx` を作成（空状態 / エラー / グリッド + LoadMore）
- [x] `components/favorites-content.tsx` を作成（認証確認 + 初期ページ取得）
- [x] `app/(site)/favorites/page.tsx` を作成
- [x] `components/header.tsx` にログイン時のみのお気に入りリンクを追加
- [x] `tests/unit/components/favorite-images.test.tsx` を作成して通す
- [x] `tests/unit/components/favorites-content.test.tsx` を作成して通す
- [x] `tests/unit/components/load-more-button.test.tsx` に endpoint 切り替えのケースを追加
- [x] `tests/unit/components/header.test.tsx` にお気に入りリンクの表示条件を追加

## フェーズ8: e2e（PR2）

- [x] `tests/e2e/favorites.test.ts` を作成（未ログイン視点）
  - [x] 未ログイン: ヘッダーにお気に入りリンクが出ない / `/favorites` でログイン誘導
  - [x] ログイン済みシナリオは `tests/e2e/favorites-authenticated.test.ts` に分離
        （`authenticated` プロジェクト専用。登録 → `/favorites` に表示 → 解除 → リロードで空状態）
  - [x] CI の Supabase Local はデータ空なので、認証済みテストは
        サインイン済みクライアントで `lgtm_images` にフィクスチャを投入してから検証する
- [x] `playwright.config.ts` の `authenticated` プロジェクトで favorites の認証シナリオが動くようにする
- [x] ローカルで e2e を実行して通す
  （`set -a; source .env.local; set +a; pnpm run test:e2e`）

## フェーズ9: 品質チェックと修正

- [x] すべてのテストが通ることを確認（`pnpm run test`）
- [x] リント / 型エラーがないことを確認（`pnpm run lint` / `pnpm run typecheck`）
      ※ `pnpm run check` は既存の `tests/unit/lib/image/compose-lgtm.test.ts` の
      フォーマット差分（origin/main 時点から存在・本 PR の変更対象外）で失敗する。
      CI のゲートは `pnpm run lint` のため影響なし
- [x] 型エラーがないことを確認（`pnpm run typecheck`）
- [x] ビルドが成功することを確認（`pnpm run build`）
- [x] カバレッジ閾値を割らないことを確認（`pnpm run test:coverage`）

## フェーズ10: ドキュメント更新

- [x] `docs/functional-design.md` の「未実装 / #198」注記を解除
  - [x] お気に入り API のレスポンス形状・エラーコードを実装に合わせて更新
  - [x] `GET /api/favorites/ids` のセクションを追加
  - [x] RLS ポリシーとカラム GRANT を実装どおりに記載
  - [x] `FavoriteService` のインターフェースを実装に合わせて更新
- [x] `docs/product-requirements.md` のお気に入り未実装注記を解除
- [x] `docs/repository-structure.md` の「未実装の P0 機能（お気に入り）で追加予定のファイル」を削除し、構造図・ディレクトリ詳細へマージ
- [x] `docs/architecture.md` / `docs/glossary.md` の未実装注記を解除
- [x] `docs/development-guidelines.md` に「データを前提とする認証済み e2e」の書き方を追記
- [x] `supabase/CLAUDE.md` に Supabase Local のデフォルト権限ドリフト対処を追記
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-08-20

### 計画と実績の差分

**計画と異なった点**:
- **`GET /api/favorites/ids` を追加した（Issue の API 3 本 + 1）**。Issue の受け入れ条件
  「ハートが登録済み状態で表示される」を満たすには、クライアントがお気に入り済み ID を知る必要がある。
  トップ一覧は `'use cache'` で匿名キャッシュされ、「もっと読み込む」「ランダム表示」は
  クライアント fetch でカードを増やすため、サーバー側でユーザー固有の状態を埋め込めない。
  「1 セッション 1 回だけ ID 集合を取得する」方式が唯一整合した。
- **トーストは汎用ライブラリを入れず、`FavoriteProvider` 内の最小 live region で実装した**。
  既存に `components/ui/toast.tsx` は無く、お気に入り以外に用途も無いため。
- **e2e を 2 ファイルに分割した**。`favorites.test.ts`（未ログイン / chromium）と
  `favorites-authenticated.test.ts`（ログイン済み / authenticated プロジェクト）。
  既存の `auth-callback.test.ts` と同じ「ファイル単位で前提状態が分かる」規約に合わせた。
- **`LoadMoreButton` に `endpoint` prop を足して再利用した**。お気に入り一覧のレスポンス形状を
  画像一覧と同一にしたため、コンポーネントの複製が不要になった。
- **マイグレーションで必要な権限を明示 GRANT した**。当初は Supabase のデフォルト権限に任せる
  つもりだったが、ローカルで権限ドリフトを踏んだため環境非依存にした（下記「学んだこと」）。

**新たに必要になったタスク**:
- ログイン状態が確定するまでハートを disabled にする `authResolved` の導入。
  自己レビューで「`/api/favorites/ids` の解決前にハートを押すと、ログイン済みユーザーでも
  `signedIn === false` と判定されて GitHub OAuth に飛ばされる」競合を発見したため。
  取得の成否によらず必ず解除する（`finally`）ようにし、失敗時にボタンが永久 disabled に
  ならないことも回帰テストで固定した。
- 認証済み e2e 用のフィクスチャ投入。CI の Supabase Local はデータ空で起動するので、
  既存データに依存すると「登録 → 一覧 → 解除」が常に skip され受け入れ条件を検証できない。
  サインイン済みクライアントから `lgtm_images` へ直接 INSERT する形にした。
- ローカル DB の権限修復。`db reset` 後にアプリ全体が `42501 permission denied` で動かなくなった。

**技術的理由でスキップしたタスク**: なし（全タスク完了）。

**検証で見つけて直したもの**:
- **Context Provider でレイアウトを包んだことによる DOM の一時的な二重化（自作の回帰）**。
  `FavoriteProvider`（クライアントコンポーネント）で `(site)` レイアウトを包むと、
  Suspense 境界を含むサーバーコンポーネントの children がクライアント境界を跨ぐことになり、
  ハイドレーション中に一覧・ヘッダーの DOM が約 100ms 二重に存在した。
  画面のちらつきになるうえ、`getByTestId` が 2 要素に解決して既存 e2e が 7 件壊れた
  （データが存在するときだけ顕在化するため、DB が空だと skip されて気付けない）。
  ブラウザで 50ms 間隔サンプリングして「Provider あり = 最大 2 / なし = 最大 1」を実測し、
  `{children}` だけを包む形でも再現することを確認したうえで、
  **Context をやめてモジュールスコープのストア + `useSyncExternalStore`** に置き換えた
  （`components/favorite-store.ts`）。トーストは children を包まない葉コンポーネント
  `components/favorite-toaster.tsx` として配置。修正後に二重化が消えることを再実測し、
  データを投入した状態での e2e 30 件パスも確認した。
- トーストのタイマー競合（implementation-validator の指摘）。短時間に 2 件失敗すると
  2 本の `setTimeout` が並走し、1 本目の満了で 2 本目のメッセージが規定時間より早く消える。
  `useRef` でタイマーを 1 本に保ち、再表示のたびに張り直す形へ修正。
  回帰テストは「修正を戻すと失敗する」ことを実際に確認済み。アンマウント時の
  `clearTimeout` も併せて追加した。

### 学んだこと

**技術的な学び**:
- **クライアントコンポーネントでサーバーコンポーネントの Suspense 境界を包むと、
  ハイドレーション中に DOM が一時的に二重化する**。`cacheComponents` 下の App Router で
  実測（約 100ms）。「グローバルな状態だから Provider でレイアウトを包む」という
  反射的な設計がそのまま罠になる。ツリーにラッパーを挿さずに済む
  モジュールストア + `useSyncExternalStore` なら原理的に起こらない。
  Provider を `{children}` だけに絞っても解決しない（境界を跨ぐこと自体が原因）。
- **「データが無ければ skip」する e2e は、この種の回帰を隠す**。CI も含めて常に skip
  されていたため、7 件のテストが実は壊れていることに終盤まで気付かなかった。
- **Supabase CLI 2.114 系のローカルイメージは public スキーマのデフォルト権限に DML を含めない**。
  `db reset` すると anon / authenticated / service_role に `TRUNCATE, REFERENCES, TRIGGER` しか
  付かず、既存テーブルを含むアプリ全体が 42501 で落ちる。CI は CLI 2.98.0 をピンしているため
  影響を受けていない。本番は古いデフォルト権限で作られているので、マイグレーションで一括 grant を
  足すのは本番の権限を緩めるだけで害しかない。直すべきはローカル DB の状態であり、
  新規テーブルは `favorites` のようにマイグレーション内で必要な権限を明示 grant しておくと
  環境差の影響を受けない。対処手順は `supabase/CLAUDE.md` に記載した。
- **service_role は本リポジトリの Supabase では PostgREST 経由でテーブルを触れない**。
  e2e のフィクスチャ投入は「サインイン済みの authenticated ロール」で RLS ポリシーを通す方が、
  本番と同じ経路を通るぶん確実だった。
- **PostgREST の埋め込み select は `!inner` にしないと外部結合になる**。
  `lgtm_images!inner(...)` + `eq('lgtm_images.status', 'active')` で、論理削除済み画像の
  お気に入りが行ごと返らなくなる。left join だと画像が null の行が残る。
- **楽観更新の e2e はクリック直後に遷移すると in-flight のリクエストが中断される**。
  UI の見た目（オプティミスティック反映）は即座に成功するので、アサーションは通るのに
  DB には何も残らない、という気付きにくい失敗になる。`page.waitForResponse` で
  レスポンス到着を待ってから次の操作へ進む必要がある。
- **Suspense のストリーミング中は解決済みコンテンツが一時的にページ本体の外側にも現れる**。
  `getByTestId` が 2 要素に解決して strict mode violation になるため、ページ本体の
  testid にスコープして一意に特定する。
- 409（登録済み）/ 404（解除済み）は「望む状態と一致」しているので UI では成功として扱う。
  冪等な操作をエラー表示しないことで、二重クリックや再送でユーザーが混乱しない。

**プロセス上の改善点**:
- 既存の `ImageService` / `ImageRepository` / route handler / テストのパターンを先に読み切ってから
  書いたので、レビュー指摘になりやすい「既存と違う書き方」をほぼ作らずに済んだ。
- フェーズを「DB → 型 → Repository → Service → Route → UI → e2e → 品質 → docs」の順に切ったことで、
  各段でテストを緑にしながら前進でき、後戻りが発生しなかった。

### 次回への改善提案
- **クライアント側のグローバル状態は、まずツリーを包まない方法（モジュールストア）を検討する**。
  Context Provider をレイアウトに挿すのは、上記の二重化を招くうえ、
  サーバーコンポーネントのストリーミング特性と相性が悪い。
- **UI を触る PR では「データがある状態」で e2e を一度回す**。空 DB のままだと
  主要なテストが skip され、回帰を検出できない。
- **着手前にローカル DB を一度 `db reset` して健全性を確認する**。今回は権限ドリフトが
  実装終盤の e2e ではじめて表面化し、原因切り分けに時間を使った。
- **データ前提の e2e はフィクスチャ投入込みで設計する**。「データが無ければ skip」は
  既存の慣習だが、受け入れ条件そのものを検証するテストでは意味を持たない。
- お気に入り件数が増えた場合に `GET /api/favorites/ids` が肥大化する。
  実運用のデータを見て、必要なら「表示中の画像 ID を渡して絞る」方式へ切り替える。
