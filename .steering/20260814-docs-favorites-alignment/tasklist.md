# タスクリスト

対応 Issue: [#282](https://github.com/kakikubo/lgtmhub/issues/282)

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

## フェーズ1: `docs/repository-structure.md` の実態反映

- [x] 構造図（L5-130）を実在ファイルのみで再構成する
  - [x] `app/` を実態に修正（favorites 削除、`loading.tsx` / `test-signin` / `random` / `regenerate` / `api/CLAUDE.md` 追加）
  - [x] `src/` を実態に修正（favorite 系 3 ファイル削除、`cache/` `profile/` `auth/require-admin.ts` `supabase/anon.ts` `utils.ts` `validation/create-image-error.ts` `src/CLAUDE.md` 追加）
  - [x] `components/` を実在 13 ファイル + `ui/{button,alert-dialog}.tsx` に修正
  - [x] `supabase/` のマイグレーション 7 本を実ファイル名に修正、`CLAUDE.md` 追加
  - [x] `tests/` を実態（`unit/{api,components,lib,repositories,services}` / `integration` は枠のみ / `e2e` 7 本 + `global-setup.ts` / `setup/`）に修正
  - [x] `public/` を `default-avatar.svg` / `fonts/` に修正
  - [x] `.github/` を実態（workflows 6 本 + `PULL_REQUEST_TEMPLATE.md` / `release-drafter.yml`）に修正
  - [x] `scripts/` を追加
  - [x] ルート直下の設定ファイル群を実態に合わせて追加（`lefthook.yml` / `codecov.yml` / `renovate.json` / `.coderabbit.yaml` / `vercel.json` / `pnpm-workspace.yaml` / `components.json` / `global.d.ts` 等）

- [x] ディレクトリ詳細セクションを実態に合わせる
  - [x] `src/services/` の配置ファイル一覧から `favorite-service.ts` を削除
  - [x] `src/repositories/` から `favorite-repository.ts` を削除し `user-profile-repository.ts` を追記
  - [x] `src/lib/` の表に `cache/` `profile/` を追加、`auth/` の説明を更新
  - [x] `src/types/` から `favorite.ts` を削除
  - [x] `components/` の `ui/` 説明を実態（Base UI ベース、`button.tsx` / `alert-dialog.tsx`）に修正
  - [x] `supabase/` の命名規則の例を実在ファイル名に修正
  - [x] `tests/` の構造・命名規則・対応関係表を実態に修正（`integration/` が枠のみである旨を明記）

- [x] 「未実装の P0 機能（お気に入り）で追加予定のファイル」セクションを新設する
  - [x] 構造図から外した favorites 関連ファイルを列挙
  - [x] `app/api/favorites/` が `.gitkeep` のみで枠確保済みである旨を明記
  - [x] #198 実装完了時に本体へマージする運用を注記

- [x] P1 セクションの記述を修正する
  - [x] `components/image-upload-form.tsx` を既存 `image-register-form.tsx` の拡張として書き換え

- [x] ファイル配置規則・命名規則の表の例を実在パスに修正する
  - [x] `app/(site)/favorites/page.tsx` を実在ルートに差し替え
  - [x] マイグレーション例を `20260504000000_create_lgtm_images.sql` に修正

## フェーズ2: `docs/functional-design.md` の未実装明示

- [x] `### エンティティ: Favorite` に未実装注記を追加する
- [x] ER 図の `FAVORITES` に未実装である旨を注記する
- [x] 画面遷移図のお気に入り遷移に `（未実装 / #198）` を付記する
- [x] お気に入り API 3 セクション（追加 / 解除 / 一覧取得）に未実装注記を追加する
- [x] UI 設計のお気に入りボタン・お気に入りタブに `（未実装 / #198）` を付記する
- [x] コンポーネント設計のページ構成図の favorites に未実装コメントを付記する
- [x] `**FavoriteService**` に `（未実装 / #198）` を付記する
- [x] RLS ポリシーの `favorites` に未実装コメントを付記する
- [x] テスト戦略のお気に入り 3 項目に `（未実装 / #198）` を付記する
- [x] `status` ライフサイクル・一覧 API 補足の「お気に入り一覧 API」言及に未実装である旨を付記する

## フェーズ3: `docs/product-requirements.md` の実装状況明示

- [x] `#### 4. お気に入り機能` に実装状況注記（未実装 / #198 で実装予定）を追加する
- [x] セカンダリー KPI の「お気に入り登録数」の計測開始と補足を修正する
- [x] 機能2・機能6 の受け入れ条件の「お気に入り一覧から非表示」に未実装である旨を付記する

## フェーズ4: `docs/glossary.md` の未実装明示

- [x] `### お気に入り` に未実装注記を追加し、API パス・データモデルの記載を予定として明示する
- [x] `### Favorite (お気に入りエンティティ)` に未実装注記を追加する
- [x] `src/lib/validation/` の例 `favorite.ts` を実在する `create-image-error.ts` に差し替える
- [x] その他のお気に入り言及箇所（一覧 API / E2E / MVP / コンポーネント例）に `（未実装）` を付記する

## フェーズ5: `docs/architecture.md` の未実装明示

- [x] データ永続化戦略の表の「お気に入り」行に `（未実装 / #198）` を付記する
- [x] 論理削除とキャッシュの「お気に入り一覧 API」言及に未実装である旨を付記する
- [x] E2E シナリオの「お気に入り追加・解除が動作する」に `（未実装 / #198）` を付記する

## フェーズ6: 品質チェックと修正

- [x] docs 記載パスの実在チェックスクリプトを実行し、未実装セクション以外に実在しないパスが無いことを確認する
- [x] `implementation-validator` サブエージェントで変更内容を検証する
  - [x] 指摘対応: 未実装マーカーの表記ゆれ（`〈〉` / `※` 版）を `（未実装 / #198）` に統一
  - [x] 指摘対応: Issue リンクはブロック注記のみに付け、行内マーカーはプレーン `#198` に統一
  - [x] 指摘対応: サブディレクトリ配下の `.gitignore` を省略する旨と表記規約を冒頭注記に明記
  - [x] 指摘対応: `functional-design.md` の統合テスト節が `tests/integration/` の実態（空）と食い違う点に注記を追加
- [x] `pnpm run check`（Biome）が成功することを確認（docs/ は Biome の対象外。残る 1 件の format エラーは未変更の tests/unit/lib/image/compose-lgtm.test.ts で origin/main 由来の既存事象）
- [x] `pnpm run typecheck` が成功することを確認
- [x] `pnpm run test` が成功することを確認

## フェーズ7: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-08-14

### 成果物

ブランチ `docs/282-align-favorites-docs`（base: `origin/main` = b3d8700）。docs 6 ファイルを変更。

| ファイル | 変更内容 |
|---------|---------|
| `docs/repository-structure.md` | 構造図を実在ファイルのみで全面再構成、ディレクトリ詳細を実態反映、「未実装の P0 機能（お気に入り）で追加予定のファイル」セクション新設、P1 セクション修正、配置規則の表・`.gitignore`・biome 設定の記載を実態に修正 |
| `docs/functional-design.md` | Favorite エンティティ / ER図 / 画面遷移図 / お気に入り API 3本 / UI設計 / ページ構成図 / FavoriteService / RLS / テスト戦略に未実装マーカー。統合テスト節に `tests/integration/` が空である旨の注記 |
| `docs/product-requirements.md` | 機能4 に実装状況注記、お気に入り KPI の計測開始時期を修正、機能2・6 の受け入れ条件に付記 |
| `docs/glossary.md` | お気に入り / Favorite に未実装注記、`src/lib/validation/` の例を実在ファイルに差し替え、波及箇所に付記 |
| `docs/architecture.md` | データ永続化戦略の表 / 論理削除とキャッシュ / E2E シナリオに付記 |
| `docs/development-guidelines.md` | 統合テストのサンプルコードが「追加予定のファイル」である旨の注記 |

### 計画と実績の差分

**計画と異なった点**:
- **ブランチのベースが想定と違った**: 作業開始時のブランチ `fix/pin-node-engines` は `origin/main` の祖先だった。`origin/main`（PR #247 = TypeScript 7 対応）の方が新しく、`dangerfile.ts` → `dangerfile.js` の改名を含んでいた。事前に取得したファイルインベントリは古いブランチの作業ツリーを見ていたため、構造図に `dangerfile.ts` と書きかけて Edit が不一致で失敗し、そこで気づいた。Renovate の major PR は作成が古くてもマージが新しいため、PR 番号の大小は時系列を意味しない。
- **修正対象が issue 記載の 3 ファイルより広かった**: issue は `functional-design.md` / `product-requirements.md` / `repository-structure.md` を挙げていたが、`glossary.md`（`POST /api/favorites`・`src/types/favorite.ts` を実在物として記載）と `architecture.md`（お気に入りテーブル・E2E シナリオ）にも同じ乖離があり、issue の検証条件「docs に記載のパス・API がすべて実在する（または未実装と明示）」を満たすには両方の修正が必要だった。
- **構造図の乖離が favorites 以外に広範だった**: issue が挙げた migration 名 / `components/ui/` / `image-upload-form.tsx` の 3 点に加え、`app/` の loading.tsx・random・regenerate・test-signin、`src/lib/` の cache/・profile/、`components/` の 8 ファイル、`tests/` の全構造、`public/`、`scripts/`、ルート設定ファイル群がすべて未記載または誤記だった。

**新たに必要になったタスク**:
- docs 記載パスの実在チェックスクリプト作成（目視では 200 ファイル規模の照合が現実的でないため）
- validator 指摘による未実装マーカーの表記統一（`〈〉` / `※` / Issue リンク有無の 3 種のゆれが発生していた）
- `functional-design.md` の統合テスト節への注記追加（`tests/integration/` が空である事実は当初 `repository-structure.md` と `development-guidelines.md` にのみ書いていた）

**技術的理由でスキップしたタスク**: なし（全タスク完了）

### 学んだこと

**技術的な学び**:
- **大きなブロックの Edit は失敗しやすい**: 130 行のツリー全体を 1 回の Edit で置換しようとして不一致で失敗した。20〜40 行単位に分割すると通った。原因の切り分けには「小さいブロックで試す」が有効。
- **ドキュメントの正確性は機械チェックできる**: docs から `app/` `src/` `components/` 等で始まるトークンを抽出し `existsSync` で照合するスクリプトで、目視では見落とす乖離を短時間で洗い出せた。拡張子なし import 指定子（`@/src/lib/errors`）は `.ts` / `.tsx` を補って解決する必要がある。残る誤検出は URL の一部・GitHub Action 参照・リポジトリ外の設定パス・将来案・gitignore パターンの 5 パターンに収束した。
- **`origin/main` を必ず fetch してから分岐する**: ローカルブランチの新旧は PR 番号や見た目では判断できない。`git log origin/main..<branch>` が空かどうかで祖先関係を確認する。

**プロセス上の改善点**:
- 読み取り専用のインベントリ調査をサブエージェントに切り出したのは有効だったが、**調査時の作業ツリーの状態（ブランチ）を明示しなかった**ため、ブランチ切り替え後に結果が 1 ファイルだけ陳腐化した。調査を依頼する前にベースブランチを確定しておくべきだった。
- 未実装マーカーの書式を design.md で 1 種類に決めていたにもかかわらず、実装中に 3 種のゆれが出た。書式規約はドキュメント本体（`repository-structure.md` 冒頭）に書き残すことで、次回以降の書き手にも効くようにした。

### 次回への改善提案
- ドキュメント整合系のタスクでは、**着手前にベースブランチを確定 → インベントリ取得 → 修正**の順を固定する。
- パス実在チェックスクリプトは CI の docs lint として常設する価値がある（今回は単発実行に留めた）。乖離の再発を機械的に防げる。
- 未実装機能を docs に残す場合、「削除せず注記＋追加予定セクションへ分離」のパターンは設計資産を失わずに誤認を防げた。#198 の実装完了時に該当セクションを本体へマージする運用まで注記に含めたので、次の担当者が判断に迷わない。

---

## 申し送り事項

1. **`origin/main` の Biome format エラーは本 PR と無関係**: `pnpm exec biome check .` が `tests/unit/lib/image/compose-lgtm.test.ts` で format エラーを 1 件出すが、このファイルは本ブランチで未変更で `origin/main` 由来。`docs/` は `biome.json` の対象外のため本変更は Biome に影響しない。ローカル Biome CLI (2.4.16) と `biome.json` の schema (2.4.14) のバージョン差が原因の可能性がある。
2. **別 Issue 候補**: `docs/glossary.md` の LgtmImage 状態遷移の記述で、Blob 物理削除が「PRD機能9」「P1機能9」と参照されているが、PRD 上は **機能8**（削除画像の物理クリーンアップ）が正しい（機能9 はファイルアップロード対応）。本 PR のスコープ（お気に入りと構造図）外のため未修正。
3. **#198 着手時の作業**: `docs/repository-structure.md` の「未実装の P0 機能（お気に入り）で追加予定のファイル」セクションを削除し、各ファイルを冒頭の構造図とディレクトリ詳細へマージする。併せて各 docs の `（未実装 / #198）` マーカーと `> **未実装**:` ブロックを削除する。
