# 設計書

## アーキテクチャ概要

「シードは DB 層 (`supabase/seed.sql`)、アサートはテスト層」という分離にする。
e2e のテストコード側では一切フィクスチャを作らず、Supabase Local の起動時点で
決定的なデータが存在している状態を作る。

```
supabase start / db reset
  └─ migrations 適用
  └─ seed.sql 適用
        ├─ auth.users に seed ユーザー 1 件 (trigger handle_new_user で user_profiles も生成)
        └─ lgtm_images に固定 UUID のフィクスチャ 5 件 (status='active')
            ↓
pnpm run build        ← この時点で DB にデータがある (重要)
            ↓
playwright webServer (pnpm run start)
            ↓
globalSetup: e2e テストユーザー作成 + storageState 生成  ※シードユーザーとは別人
            ↓
各 e2e テスト: 無条件アサート
```

### なぜ `seed.sql` か (globalSetup でのランタイム投入ではなく)

トップページの初期一覧は `src/lib/cache/list-home-images.ts` の `'use cache'` +
`cacheLife('max')` でキャッシュされ、無効化は `revalidateTag` の明示呼び出しのみ。
`next build` のプリレンダ時にこのキャッシュエントリが作られ得るため、**ビルド後に
DB へ直接 INSERT しても一覧に反映されない恐れがある**。`supabase start` 時点で
データを入れておけば、ビルド時・ランタイム双方で同じ決定的なデータが見える。

また CI ワークフロー (`.github/workflows/ci.yml`) に手順を足さずに済む
(`supabase start` が `[db.seed] enabled = true` により `seed.sql` を適用するため)。

## コンポーネント設計

### 1. `supabase/seed.sql`

**責務**:
- e2e / ローカル開発で共通に使う決定的な LGTM 画像フィクスチャを定義する

**実装の要点**:
- シードユーザーは `auth.users` に直接 INSERT する。`user_profiles` は
  マイグレーション済みトリガー `handle_new_user()` が `raw_user_meta_data` から自動生成するため、
  本番と同じ経路でプロフィールが作られる (`user_name` が必須)
- ID はすべて固定 UUID (`5eed0000-0000-4000-8000-0000000000XX`)。
  `image-detail.test.ts` が not-found 検証に使う `00000000-...-000000000000` とは衝突しない
- `created_at` は固定値 (2026-01-05) で 1 秒ずつずらし、`created_at desc` の順序を一意に決める
- `image_url` は `public/default-avatar.svg` を指す相対パス + クエリ (`?fixture=N`)。
  - 外部ネットワークに依存しない
  - next/image は `dangerouslyAllowSVG` 未設定時に `.svg` を自動的に `unoptimized` 扱いするため
    (`get-img-props.js`: `src.split('?', 1)[0].endsWith('.svg')`)、Image Optimizer の
    400 を踏まない。クエリは拡張子判定で無視されるので、5 件を別 URL にできる
- `uploader_id` はシードユーザー。globalSetup が毎回削除 / 再作成する e2e テストユーザーとは
  別人にして、cascade 削除でフィクスチャが消えないようにする
- 冪等化のため先頭で `delete from auth.users where id = <seed user>` を実行する
  (`db reset` では不要だが、手動で seed.sql を流し直せるようにする)

**フィクスチャ件数 = 5 の理由**:
`components/image-grid.tsx` の `PRIORITY_IMAGE_COUNT = 4`。5 件あると
「先頭 4 枚は priority / 5 枚目は lazy」のコントラストを e2e で検証できる。

### 2. `tests/e2e/fixtures/seed-images.ts`

**責務**:
- `seed.sql` が入れたフィクスチャの ID・URL・件数を TypeScript 側の定数として公開する

**実装の要点**:
- SQL とテストで二重管理になる値をこの 1 ファイルに閉じ込め、ズレたら型ではなく
  テスト失敗で気付けるようにする (SQL からの自動生成はしない)

### 3. e2e テスト群 (無条件アサート化)

| ファイル | 変更内容 |
| --- | --- |
| `image-list.test.ts` | `grid.or(empty).or(error)` → `image-grid` を直接期待。`gotoAndRequireGrid` から skip を除去し `gotoAndGetGrid` に改名。priority テストを Next 16 の実挙動に合わせて書き直し。ランダム 0 件の空状態テストを追加 |
| `image-detail.test.ts` | 3 箇所の empty/error skip と fallback skip を削除。投稿者は必ずシードユーザー (`data-fallback="false"`) |
| `image-deletion.test.ts` | empty/error skip を削除 |
| `favorites.test.ts` | empty/error skip を削除 |

**priority テストの書き直し (重要)**:
Next.js 16.3 の `next/image` は `priority` を **`fetchpriority="high"` / `loading="eager"` 属性には
変換しない**。`get-img-props.js` を読むと挙動は次のとおり:

- `priority` → `isLazy = false` → `loading` 属性そのものが出ない (非 priority は `loading="lazy"`)
- `priority` → `meta.preload = true` → App Router では `ReactDOM.preload(src, { as: 'image' })`
  により `<head>` に `<link rel="preload" as="image">` が出る
- `fetchPriority` は利用者が明示的に渡したときだけ `img` に載る

つまり既存の `toHaveAttribute('fetchpriority', 'high')` は、シードデータを入れて
skip を外すと **Next 16 では必ず失敗する**。アプリ側に `fetchPriority="high"` を足すのではなく
(フレームワークの現行既定に従う)、`priority` が剥がれたことを検出できる実挙動でアサートする:

1. 先頭カードの `img` に `loading` 属性が無い
2. 5 枚目 (`PRIORITY_IMAGE_COUNT` 超) の `img` は `loading="lazy"`
3. `<head>` に先頭画像の `link[rel="preload"][as="image"]` がある

### 4. `tests/e2e/reporters/fail-on-skip.ts`

**責務**:
- CI 実行時に skip されたテストが 1 件でもあれば e2e を失敗させる

**実装の要点**:
- `onTestEnd` で `result.status === 'skipped'` を収集し、`onEnd` で
  `{ status: 'failed' }` を返して終了コードを落とす (Playwright 1.44+ の reporter API)
- `playwright.config.ts` の `reporter` に **CI のときだけ** 追加する。
  ローカルではデバッグ目的の `test.skip` を許容する

## データフロー

### CI (e2e ジョブ)
```
1. supabase start        → migrations + seed.sql でフィクスチャ 5 件
2. pnpm run build        → 'use cache' のプリレンダもフィクスチャ入りで作られる
3. playwright test
   3-1. webServer (pnpm run start) 起動
   3-2. globalSetup: e2e テストユーザー作成 (シードユーザーとは別) + storageState
   3-3. chromium / authenticated プロジェクト実行 (skip 0)
4. fail-on-skip reporter が skip 0 を保証
```

### ローカル
```
1. supabase db reset     → フィクスチャ投入 (既存ローカルデータは破棄される)
2. set -a; source .env.local; set +a; pnpm run test:e2e
```

## エラーハンドリング戦略

このタスクはテストとシードのみでアプリのエラー処理は変更しない。
唯一の「失敗の作り込み」は fail-on-skip reporter による CI の明示的な失敗。

## テスト戦略

### ユニットテスト
- 変更なし。0 件表示 (空状態) は `tests/unit/components/home-images.test.tsx`
  (`画像が空なら空状態を出す`) で既にカバー済みのため、e2e では
  **ランダム表示 API をモックした 1 本だけ**を明示的な空状態テストとして持つ

### e2e
- 一覧 / 詳細 / 削除 / お気に入りの全テストが skip なしで実行される
- `grep -rn "test.skip" tests/e2e/` が 0 件

## 依存ライブラリ

追加なし。

## ディレクトリ構造

```
supabase/
  seed.sql                      (変更: フィクスチャ追加)
tests/e2e/
  fixtures/
    seed-images.ts              (新規: シード定数)
  reporters/
    fail-on-skip.ts             (新規: CI 用 reporter)
  image-list.test.ts            (変更)
  image-detail.test.ts          (変更)
  image-deletion.test.ts        (変更)
  favorites.test.ts             (変更)
playwright.config.ts            (変更: CI 時に reporter 追加)
docs/development-guidelines.md  (変更: シードデータの前提を追記)
```

## 実装の順序

1. `supabase/seed.sql` にフィクスチャを追加し、`supabase db reset` で反映を確認
2. `tests/e2e/fixtures/seed-images.ts` を追加
3. 4 ファイルの `test.skip` を削除し無条件アサートへ置き換え
4. priority テストを Next 16 の実挙動に合わせて書き直し
5. ランダム 0 件の空状態テストを追加
6. fail-on-skip reporter と `playwright.config.ts` の配線
7. 本番ビルド相当 (`CI=true`) で e2e 実行し skip 0 / 全パスを確認
8. ドキュメント更新
