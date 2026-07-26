# タスクリスト

## 概要

Issue #274: `user_profiles` のカラム単位 GRANT で `is_admin` 自己昇格を防ぐ。

## フェーズ1: 脆弱性の再現 (before 検証)

- [x] ローカル Supabase が起動していることを確認する (`supabase status`)
- [x] 現行スキーマで authenticated ロールが自分の行の `is_admin = true` を UPDATE できてしまうことを SQL で再現・記録する
  - 再現結果: `set local role authenticated` + JWT sub 一致で `update ... set is_admin=true` が UPDATE 1 で成功し `is_admin` が f→t に昇格した

## フェーズ2: マイグレーション実装

- [x] `supabase/migrations/20260720000000_restrict_user_profiles_column_grants.sql` を作成する
  - [x] `anon, authenticated` から `user_profiles` の INSERT / UPDATE をまとめて REVOKE する
  - [x] `authenticated` に UPDATE (display_name, avatar_url) を GRANT する
  - [x] `authenticated` に INSERT (id, github_login, display_name, avatar_url) を GRANT する
  - [x] 意図をコメントで明記する (RLS は行、GRANT は列を守る旨)

## フェーズ3: 適用と after 検証

- [x] `supabase migration up` (または `db reset`) でマイグレーションを適用する
- [x] authenticated ロールで `is_admin` の UPDATE が permission denied になることを確認する
- [x] authenticated ロールで `display_name` / `avatar_url` の UPDATE が成功し `updated_at` が更新されることを確認する
- [x] authenticated ロールで `is_admin` を含む INSERT が permission denied になることを確認する

## フェーズ4: 型再生成と検証

- [x] `pnpm run db:types` を実行し `src/types/database.types.ts` に差分が出ないことを確認する (GRANT は型に影響せず差分ゼロ)
- [x] `pnpm run typecheck` を実行しパスすることを確認する (tsc --noEmit エラーなし)
- [x] `pnpm run test` を実行しパスすることを確認する (22 files / 273 tests all passed)
- [x] `pnpm run check` を実行 → 失敗するが、原因は既存の biome バージョン差分 (`^2.4.14`→2.5.4) による未変更ファイル `tests/unit/lib/image/compose-lgtm.test.ts` のフォーマット差分。origin/main でも同様に再現する既存問題で、今回の SQL マイグレーション (biome 非検査対象) とは無関係。追加ファイル単体の biome check はパス

---

## 実装後の振り返り

- 実装完了日: 2026-07-20

### 計画と実績の差分
- 計画通り。マイグレーション 1 ファイルの追加のみで完結し、アプリコード・RLS ポリシーの変更は不要だった。
- validator 提案を受け、`anon` への REVOKE 意図を示すコメントを 1 行追加した(多層防御の意図を単体ファイルで読めるように)。

### 学んだこと
- Supabase の RLS は「行」を制限するが「列」は制限しない。列レベルの保護は PostgreSQL の
  カラム単位 GRANT が担う。`auth.uid() = id` の RLS だけでは特権カラム(is_admin)の自己更新を防げない。
- カラム権限チェックは UPDATE 文で明示的に SET したカラムにのみ働くため、トリガが代入する
  `updated_at` は GRANT に含めなくてよい。
- `security definer` 関数(handle_new_user)は所有者権限で走るため、ロールへの REVOKE の影響を受けない。
- 環境: ローカルの pnpm は mise(10.4.1)と corepack pin(11.13.0)が混在。検証は `corepack pnpm` を使う。
  `pnpm run check` は既存の biome バージョン差分(未変更ファイル compose-lgtm.test.ts)で失敗するが本変更とは無関係。

### 次回への改善提案 (別 Issue 候補)
- カラム GRANT の回帰防止テスト(pgTAP または integration テスト)が無い。将来 is_admin を
  更新するコードが混入しても手動レビューでしか検知できないため、DB レベルのテスト基盤導入を検討する。
- `pnpm run check` を止めている biome バージョン差分は本 PR と独立した既存問題。別途追跡が望ましい。
