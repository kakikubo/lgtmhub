# 設計書

## 方針概要

ドキュメント専用の変更。アプリケーションコードは一切変更しない。

基本方針は 2 つ:

1. **未実装機能の記述は消さずに「未実装」ラベルを付ける** — お気に入りの設計内容は #198 の実装時にそのまま使える資産なので削除しない。読者が実装済みと誤認しないように、各セクションの冒頭に統一フォーマットの注記を置く。
2. **`repository-structure.md` の構造図は「実在するものだけ」に絞る** — 構造図は「今のリポジトリはこうなっている」を示す図であり、予定を混ぜると価値が落ちる。未実装ファイルは末尾の「追加予定のファイル」セクションへ分離する（既存の `## P1フェーズで追加予定のファイル` と同じ扱い）。

## 注記フォーマット（統一）

既存ドキュメントは `> **注**:` と `> TODO（将来対応）:` の 2 種類の blockquote 注記を使っている。これに揃えて次の 1 フォーマットに統一する。

```markdown
> **未実装**: {対象の説明}。[#198](https://github.com/kakikubo/lgtmhub/issues/198) で実装予定。本セクションは実装時の設計指針であり、現時点で該当するコード・テーブル・エンドポイントは存在しない。
```

短い箇所（表の行・箇条書きの 1 項目・図中のノード）では、行内に `（未実装 / #198）` を付記する形に縮約する。

## 実装の実態（調査結果）

修正の根拠となる実在ファイルの一覧。

### お気に入り関連で実在するもの

| パス | 実態 |
|------|------|
| `app/api/favorites/.gitkeep` | 空ファイル。ディレクトリ枠のみ確保、`route.ts` は無い |

上記以外に `favorite` を含む実装コード・テストは **1 件も存在しない**。`src/types/database.types.ts` の `Tables` は `daily_upload_counts` / `lgtm_images` / `user_profiles` の 3 つのみで、`favorites` テーブルは未定義。

### `repository-structure.md` の構造図と実態の差分

| 箇所 | ドキュメントの記載 | 実態 |
|------|------------------|------|
| `app/(site)/favorites/page.tsx` | 記載あり | 存在しない |
| `app/api/favorites/route.ts` `[lgtmImageId]/route.ts` | 記載あり | `.gitkeep` のみ |
| `app/(site)/images/*/loading.tsx` | 記載なし | 2 ファイル実在 |
| `app/api/auth/test-signin/route.ts` | 記載なし | 実在 |
| `app/api/images/random/route.ts` | 記載なし | 実在 |
| `app/api/images/[id]/regenerate/route.ts` | 記載なし | 実在 |
| `app/api/CLAUDE.md` | 記載なし | 実在（Route Handler 規約） |
| `src/services/favorite-service.ts` | 記載あり | 存在しない |
| `src/repositories/favorite-repository.ts` | 記載あり | 存在しない |
| `src/types/favorite.ts` | 記載あり | 存在しない |
| `src/lib/validation/favorite.ts` | 記載あり | 存在しない |
| `src/lib/validation/create-image-error.ts` | 記載なし | 実在 |
| `src/lib/auth/require-admin.ts` | 記載なし | 実在 |
| `src/lib/cache/list-home-images.ts` | 記載なし | 実在 |
| `src/lib/profile/resolve-uploader-display.ts` | 記載なし | 実在 |
| `src/lib/supabase/anon.ts` | 記載なし | 実在 |
| `src/lib/utils.ts` | 記載なし | 実在 |
| `src/CLAUDE.md` | 記載なし | 実在 |
| `components/favorite-button.tsx` | 記載あり | 存在しない |
| `components/ui/dialog.tsx` `toast.tsx` | 記載あり | 存在しない（実在は `alert-dialog.tsx`） |
| `components/` その他 | 一部のみ記載 | 実在は 13 ファイル（`home-content.tsx` / `home-images.tsx` / `image-detail-actions.tsx` / `image-regenerate-action.tsx` / `load-more-button.tsx` / `uploader-profile-row.tsx` / `header-skeleton.tsx` / `image-grid-skeleton.tsx` を含む） |
| `supabase/migrations/2026050200000*` | 4 本を記載 | 実在は `20260503000000` 〜 `20260720000000` の 7 本、favorites は無し |
| `supabase/CLAUDE.md` | 記載なし | 実在 |
| `tests/unit/**` | `lib/` `services/` のみ | 実在は `api/` `components/` `lib/` `repositories/` `services/` |
| `tests/integration/**` | 2 ファイル記載 | `.gitkeep` のみで実テスト無し |
| `tests/e2e/**` | 3 ファイル記載（favorites 含む） | 実在は `auth.test.ts` / `auth-callback.test.ts` / `image-deletion.test.ts` / `image-detail.test.ts` / `image-list.test.ts` / `image-register.test.ts` / `smoke.test.ts` + `global-setup.ts` |
| `tests/setup/component-setup.ts` | 記載なし | 実在 |
| `public/og-image.png` `favicon.ico` | 記載あり | 存在しない（実在は `default-avatar.svg` / `fonts/`） |
| `.github/workflows/` | `ci.yml` `danger.yml` のみ | 実在は 6 本（`_supabase-push.yml` / `ci.yml` / `danger.yml` / `release-drafter.yml` / `supabase-deploy.yml` / `supabase-preview-migrate.yml`）+ `PULL_REQUEST_TEMPLATE.md` / `release-drafter.yml` |
| `scripts/` | 記載なし | 実在（`preview-lgtm-fonts.ts` / `supabase-migrate-to-tokyo.sh`） |
| ルート直下 | 一部のみ記載 | `lefthook.yml` / `codecov.yml` / `renovate.json` / `.coderabbit.yaml` / `vercel.json` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `.npmrc` / `components.json` / `global.d.ts` / `next-env.d.ts` / `LICENSE` / `.devcontainer/` が未記載 |
| P1 セクション `components/image-upload-form.tsx` | 新規ファイルとして記載 | 既存の `components/image-register-form.tsx` と役割が重複 |

## 変更対象ファイルと変更内容

### 1. `docs/repository-structure.md`（主対象）

**変更 A: 構造図の全面差し替え**

実在するファイルのみで構成し直す。gitignore 対象（`.next/` `coverage/` `.vercel/` `supabase/.temp/` 等）と `.gitkeep` は列挙しない。

```
lgtmhub/
├── app/
│   ├── (site)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── images/
│   │       ├── new/{page,loading}.tsx
│   │       └── [id]/{page,loading}.tsx
│   ├── api/
│   │   ├── CLAUDE.md
│   │   ├── auth/{callback,test-signin}/route.ts
│   │   ├── images/route.ts
│   │   ├── images/random/route.ts
│   │   └── images/[id]/{route.ts,regenerate/route.ts}
│   ├── globals.css
│   └── layout.tsx
├── src/{CLAUDE.md,services,repositories,lib,types}
├── components/{...,ui/{button,alert-dialog}.tsx}
├── supabase/{CLAUDE.md,config.toml,seed.sql,migrations/*.sql}
├── tests/{unit,integration,e2e,setup}
├── public/{default-avatar.svg,fonts/}
├── docs/
├── scripts/
├── .github/{PULL_REQUEST_TEMPLATE.md,release-drafter.yml,workflows/}
└── （ルート設定ファイル群）
```

**変更 B: `app/api/favorites/` の扱い**

`.gitkeep` のみのディレクトリは構造図には出さず、「追加予定のファイル」セクションで「ディレクトリ枠のみ確保済み」と説明する。

**変更 C: ディレクトリ詳細セクションの配置ファイル一覧を実態に合わせる**

- `src/services/` から `favorite-service.ts` を削除
- `src/repositories/` から `favorite-repository.ts` を削除、`user-profile-repository.ts` を追記
- `src/lib/` の表に `cache/` `profile/` を追加、`auth/` の説明に `require-admin.ts` を追記
- `src/types/` から `favorite.ts` を削除
- `components/` の `ui/` 説明を実態（`button.tsx` / `alert-dialog.tsx`、Base UI ベース）に修正
- `tests/` の構造・対応関係表を実態に合わせる（`integration/` は枠のみである旨を明記）
- マイグレーション命名規則の例を実在ファイル名に変更

**変更 D: 「未実装の P0 機能（お気に入り）で追加予定のファイル」セクションを新設**

既存の `## P1フェーズで追加予定のファイル` の直前に配置し、構造図から外した favorites 関連ファイルをここへ集約する。

**変更 E: P1 セクションの `image-upload-form.tsx` を修正**

既存の `components/image-register-form.tsx` を拡張する方針に書き換え、テスト名も `tests/e2e/image-upload.test.ts` の記載を維持しつつ「新規ファイル」ではなく「既存拡張」と明示する。

**変更 F: ファイル配置規則の表の例を実在パスへ**

`app/(site)/favorites/page.tsx` → `app/(site)/images/[id]/page.tsx`、`20260502000000_create_lgtm_images.sql` → `20260504000000_create_lgtm_images.sql`。

### 2. `docs/functional-design.md`

| 対象 | 変更内容 |
|------|---------|
| `### エンティティ: Favorite`（L100） | 見出しに `（未実装 / #198）` を付け、直下に未実装注記を追加 |
| ER 図（L138-185） | 図の直前に `FAVORITES` が未実装である旨の注記を追加 |
| 画面遷移図（L205-206） | お気に入り一覧への遷移に `（未実装 / #198）` を付記 |
| `### お気に入り追加/解除/一覧取得`（L403/433/451） | 3 見出しに `（未実装 / #198）` を付け、3 セクションを束ねる未実装注記を追加 |
| UI 設計（L645/649） | お気に入りボタン・お気に入りタブの行に `（未実装 / #198）` を付記 |
| コンポーネント設計のページ構成図（L677-697） | favorites の 2 ブロックに未実装コメントを付記 |
| `**FavoriteService**`（L728） | 見出しに `（未実装 / #198）` を付記 |
| RLS ポリシー（L793-797） | `favorites` ポリシーに未実装コメントを付記 |
| テスト戦略（L832/839-840） | 3 項目に `（未実装 / #198）` を付記 |
| `status` ライフサイクル（L92）・一覧 API 補足（L241） | 「お気に入り一覧 API」への言及に未実装である旨を付記 |

### 3. `docs/product-requirements.md`

| 対象 | 変更内容 |
|------|---------|
| `#### 4. お気に入り機能`（L136） | 概要 blockquote の直後に実装状況注記を追加（未実装 / #198 で実装予定） |
| セカンダリー KPI（L66/71） | 「お気に入り登録数」の計測開始を「機能4 リリース翌月から」に修正し、未実装である旨を補足に追記 |
| 機能2・機能6 の受け入れ条件（L111/191） | 「お気に入り一覧から非表示」への言及に未実装である旨を付記 |

要求そのものは P0 のまま維持する（PRD は「何を作るか」の文書であり、未実装であること自体は矛盾ではない）。追加するのは実装状況の明示のみ。

### 4. `docs/glossary.md`

| 対象 | 変更内容 |
|------|---------|
| `### お気に入り`（L78） | 未実装注記を追加。サブ機能の API パスに `（未実装）` を付記、`src/types/favorite.ts` の記載を「#198 で追加予定」に修正 |
| `### Favorite (お気に入りエンティティ)`（L583） | 未実装注記を追加。データソースの記載を予定として明示 |
| L158 / L513 / L528 | 「お気に入り一覧」への言及に `（未実装）` を付記 |
| L274 | `src/lib/validation/` の例 `favorite.ts` を実在する `create-image-error.ts` に差し替え |
| L318 / L344 / L480 | E2E・MVP・コンポーネント例のお気に入り言及に `（未実装）` を付記 |

### 5. `docs/architecture.md`

| 対象 | 変更内容 |
|------|---------|
| データ永続化戦略の表（L122-123） | 「お気に入り」行に `（未実装 / #198）` を付記 |
| 論理削除とキャッシュ（L276） | 「お気に入り一覧 API」への言及に未実装である旨を付記 |
| E2E シナリオ（L329） | 「お気に入り追加・解除が動作する」に `（未実装 / #198）` を付記 |

### 6. `docs/development-guidelines.md`

L588 / L592 は PR 分割の**説明用の例文**であり、実在ファイルへの参照ではない。変更しない。

## 検証方法

コード変更が無いため、検証はドキュメント側の機械的チェックと既存テストの現状維持確認で行う。

### ドキュメント記載パスの実在チェック

`docs/*.md` 内のコードブロック・表・箇条書きから、リポジトリ相対パスらしき文字列を抽出し、実在するか照合するワンショットスクリプトを実行する。

```bash
# 抽出対象: app/... src/... components/... tests/... supabase/... .github/... scripts/... public/...
# 未実装セクション配下（「追加予定のファイル」以降）は除外して照合する
```

判定基準: 構造図・ディレクトリ詳細セクションに現れるパスがすべて実在すること。「追加予定のファイル」セクション配下のパスは実在しなくてよい。

### 既存の品質チェック

```bash
pnpm run check      # Biome（docs/ の Markdown も対象になりうる）
pnpm run typecheck
pnpm run test
```

コード無変更なので全て現状どおり成功することを確認する。

## リスクと対策

| リスク | 対策 |
|--------|------|
| 構造図を実態に寄せすぎてファイル追加のたびに陳腐化する | 個別ファイルの網羅より「どのディレクトリに何を置くか」が伝わることを優先。テストの `tests/unit/**` は代表例＋ディレクトリ構造で示す |
| favorites の設計情報が失われる | 削除ではなく注記追加＋「追加予定のファイル」セクションへの移設に留める。#198 の実装時に参照できる状態を維持 |
| 注記の書式がドキュメント間でばらつく | 上記「注記フォーマット（統一）」の 1 種類に統一し、短縮形も `（未実装 / #198）` に固定 |

## 実装の順序

1. `docs/repository-structure.md` — 構造図・ディレクトリ詳細・追加予定セクション・配置規則の表
2. `docs/functional-design.md` — エンティティ / API / UI / コンポーネント / RLS / テスト戦略
3. `docs/product-requirements.md` — 機能4 と KPI・関連受け入れ条件
4. `docs/glossary.md` — お気に入り / Favorite / 波及箇所
5. `docs/architecture.md` — 表・キャッシュ・E2E シナリオ
6. 検証（パス実在チェック → `check` / `typecheck` / `test`）

## 将来の拡張性

`## 未実装の P0 機能（お気に入り）で追加予定のファイル` セクションは #198 の実装完了時にそのまま削除し、構造図本体へマージする運用とする。同様に P1 各機能も実装時に本体へ昇格させる。この運用を該当セクションの末尾に注記として残す。
