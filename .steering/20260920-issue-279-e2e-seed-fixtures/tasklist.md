# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: シードデータ

- [x] `supabase/seed.sql` にシードユーザー (`auth.users`) を追加する
  - [x] 固定 UUID / `raw_user_meta_data` に `user_name` `full_name` `avatar_url`
  - [x] 再実行できるよう先頭で同 ID を delete する
- [x] `supabase/seed.sql` に `lgtm_images` フィクスチャ 5 件を追加する
  - [x] 固定 UUID・固定 `created_at` (1 秒ずつずらす)・`status='active'`
  - [x] `image_url` は `/default-avatar.svg?fixture=N`
- [x] `supabase db reset` で投入され、トップページに 5 枚表示されることを確認する
  - [x] GoTrue が NULL 文字列を読めないため `confirmation_token` 等 4 列を `''` で埋める
        (未対応だと globalSetup の `listUsers` が `Database error finding users` で落ちる)

## フェーズ2: フィクスチャ定数

- [x] `tests/e2e/fixtures/seed-images.ts` を追加し、ID / URL / 件数を公開する

## フェーズ3: 条件付き skip の廃止

- [x] `tests/e2e/image-list.test.ts` の skip を削除し無条件アサートにする
  - [x] 1 本目のテストを `image-grid` 直接アサート + 件数アサートに変更
  - [x] `gotoAndRequireGrid` を skip なしの `gotoAndGetGrid` に置き換え
- [x] `tests/e2e/image-detail.test.ts` の skip 4 箇所を削除する
  - [x] fallback skip を廃止し `data-fallback="false"` を無条件に期待する
- [x] `tests/e2e/image-deletion.test.ts` の skip を削除する
- [x] `tests/e2e/favorites.test.ts` の skip を削除する
- [x] `grep -rn "test.skip" tests/e2e/` が 0 件であることを確認する（コメント内の言及のみ）

## フェーズ4: priority テストの実挙動対応

- [x] 先頭カードの `img` に `loading` 属性が無いことを検証する
- [x] 5 枚目の `img` が `loading="lazy"` であることを検証する
- [x] `<head>` に先頭画像の `link[rel="preload"][as="image"]` が出ることを検証する
- [x] Next 16 の挙動 (priority が fetchpriority 属性にならない) をコメントで残す

## フェーズ5: 空状態テストの分離

- [x] ランダム表示 API を 0 件でモックし `image-list-empty` を検証するテストを追加する

## フェーズ6: skip 0 の保証

- [x] `tests/e2e/reporters/fail-on-skip.ts` を追加する
- [x] `playwright.config.ts` で CI 時のみ reporter を有効にする

## フェーズ7: 検証

- [x] `pnpm run check` が通る
  - worktree では `biome check .` が 0 files になる既知制約のため、明示パス
    (`./node_modules/.bin/biome check tests/e2e playwright.config.ts supabase`) で検証
- [x] `pnpm run typecheck` が通る
- [x] `pnpm run test` が通る（43 files / 422 tests）
- [x] 本番ビルド相当 (`CI=true`) で `pnpm run test:e2e` が skip 0 で全パスする（33 passed / 0 skipped）
- [x] `next dev` (ローカル既定) でも 33 passed / 0 skipped を確認する
- [x] fail-on-skip reporter が実際に落とすことを一時テストで確認する
  - CI=true: exit 1 + skip 一覧を出力 / CI 未設定: exit 0 (従来どおり)

## フェーズ8: ドキュメント

- [x] `docs/development-guidelines.md` に e2e シードデータの前提を追記する
- [x] `supabase/CLAUDE.md` に seed.sql の扱いを追記する
- [x] `README.md` の E2E 手順に `db:reset` を追加する
- [x] 実装後の振り返り（このファイルの下部に記録）

## フェーズ9: 検証指摘の反映 (implementation-validator)

- [x] 重大: `fail-on-skip` reporter に `printsToStdio(): false` を実装する
  - Playwright は「stdio 出力する reporter が 0 件」のときだけ既定の dot/line を足す。
    未実装だと html と組んだ CI で失敗時のログが一切出なくなる
  - 意図的に失敗するテストで stdout にスタックトレースが出ることを実測確認
- [x] 中: `p_hash` を `repeat(n,1024)` から 0/1 交互パターンへ変更する
  - 単色画像の pHash は全ビット `'1'` になるため、`'1'×1024` は
    `DUPLICATE_THRESHOLD=10` 以内で 409 を誤爆させうる
- [x] 中: 固定 UUID 生成を `lpad(n, 5, '0')` にし 10 件以上でも壊れないようにする
- [x] 中: 件数アサートを `expect.poll` にして auto-retry を効かせる
- [x] 中: 否定アサートの前に `toBeVisible()` を置き、要素不在の素通りを防ぐ
- [x] 軽微: preload リンクの href 比較をセレクタ埋め込みから列挙比較に変更する
- [x] 軽微: `crypt`/`gen_salt` 依存を外し bcrypt 形式のリテラルにする
- [x] 軽微: `README.md` の `db:reset` に破壊的である旨の注意を添える
- [x] 軽微: `seed-images.ts` の「先頭カード」コメントを CI 前提と明示する
- [x] 軽微: スコープ外差分 (`AGENTS.md` / `next-env.d.ts`) を revert する
- [x] ~~軽微: `PRIORITY_IMAGE_COUNT` を `components/image-grid.tsx` から export して共有する~~
      (見送り: Playwright のテストから `.tsx` を import すると React コンポーネント群と
       `@/` パスエイリアス解決を e2e ランナーに持ち込むことになり、結合が増えて割に合わない。
       定数はテスト側で複製し、双方にコメントで対応関係を残す方針を維持)

---

## 実装後の振り返り

### 実装完了日

2026-09-20

### 計画と実績の差分

**計画と異なった点**:

- **priority テストは「skip を外す」だけでは通らなかった**。Next.js 16.3 の `next/image` は
  `priority` を `fetchpriority="high"` / `loading="eager"` 属性に変換しないため、既存アサートは
  シードデータを入れた時点で必ず失敗する。アプリ側に `fetchPriority="high"` を足すのではなく、
  フレームワークの現行挙動 (preload link + `loading` 属性なし) でアサートし直した。
  サイレント skip が 3 年分の仕様変化を隠していた実例。
- **`auth.users` への直接 INSERT で GoTrue が落ちた**。`confirmation_token` / `recovery_token` /
  `email_change_token_new` / `email_change` は DEFAULT が無く NULL になり、Admin API が
  `Database error finding users` を返す。globalSetup の `listUsers` が失敗して e2e が全滅した。
- **reporter 追加で CI のログが消える罠**があった (implementation-validator の指摘)。
  Playwright は「stdio 出力する reporter が 0 件」のときだけ既定の dot/line を補う。
  `printsToStdio()` 未実装のカスタム reporter は `true` 扱いになるため、`reporter: 'html'` 単体の
  ときに効いていた自動 dot が消える。`printsToStdio(): false` で解消。

**新たに必要になったタスク**:

- フェーズ9 (検証指摘の反映) を追加。p_hash の値、UUID 生成の桁あふれ、`expect.poll` 化、
  否定アサート前の存在確認など。

### 学んだこと

**技術的な学び**:

- 「データがあれば検証する」形の実行時 skip は、CI では常に skip 側に倒れて**テストを無に帰す**。
  skip 0 を reporter で機械的に強制しないと再混入に気付けない。
- `'use cache'` + `cacheLife('max')` のページは `next build` 時にキャッシュが作られ得るため、
  e2e のフィクスチャは **ビルド前** (= `supabase start` 時の `seed.sql`) に入れる必要がある。
  globalSetup でのランタイム投入では一覧に反映されない恐れがある。
- 単色画像の pHash は全ビット `'1'`。ダミー pHash に `'1'` の繰り返しを使うと本物の画像と
  hamming 距離 0 になり、重複判定 (409) を誤爆させる。
- next/image は `dangerouslyAllowSVG` 未設定時に `.svg` を自動で `unoptimized` 扱いにし、
  その判定はクエリを無視する (`src.split('?', 1)[0].endsWith('.svg')`)。
  おかげで `/default-avatar.svg?fixture=N` を「外部通信なしで 5 件別 URL」にできた。

**プロセス上の改善点**:

- 「skip を外す」タスクは、外した先のアサートが**現行の実装で本当に通るか**を先に確かめないと
  見積もりを外す。今回は next/image のソースを読んでから書き直したので手戻りが 1 回で済んだ。
- reporter のような「CI の観測手段」を触る変更は、成功系だけでなく**失敗系の出力**も実測する。

### 次回への改善提案

- `tests/e2e/favorites-authenticated.test.ts:80` のフィクスチャも `p_hash: '1'.repeat(1024)` を
  使っており、同じ 409 誤爆のリスクがある。別 Issue で揃えたい。
- CI の e2e ジョブに `playwright-report` のアーティファクト upload が無い。失敗時の調査は
  現状 stdout のログだけが頼りなので、別 Issue で追加を検討する。
- `PRIORITY_IMAGE_COUNT` のような「実装とテストで共有したい定数」の置き場所 (例:
  `src/` 配下の純粋な定数モジュール) を決めておくと、今回のような複製を避けられる。
