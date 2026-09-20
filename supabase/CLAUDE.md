# supabase/ 規約

- マイグレーション追加後は `pnpm run db:types` で src/types/database.types.ts を再生成し、
  同じコミットに含める
- `seed.sql` は e2e / ローカル開発が前提にする決定的なフィクスチャ (Issue #279)。
  適用は `supabase start` / `supabase db reset` のみで、本番 / Preview には流れない。
  TypeScript 側の対応定数は `tests/e2e/fixtures/seed-images.ts`。両方を揃えて変更すること。
  `auth.users` へ直接 INSERT する行は `confirmation_token` / `recovery_token` /
  `email_change_token_new` / `email_change` を `''` で埋める (DEFAULT が無く、NULL のままだと
  GoTrue の Admin API が `Database error finding users` で落ちる)
- 本番と Preview は別 Supabase プロジェクト。main マージで本番へ自動 deploy される。
  PR 段階で Preview に先行適用するには apply-preview-migration ラベルを使い、
  他の PR とは直列に適用する。PR を未マージで close した場合、Preview に適用済みの
  DDL は残るため revert マイグレーションで戻す。
  詳細: docs/development-guidelines.md の Preview migration フロー
- `supabase db reset` 後にアプリが `42501 permission denied for table ...` を返す場合は、
  CLI のバージョン差で public スキーマのデフォルト権限に DML が含まれていない。本番 / CI と
  状態を揃えるため、ローカル DB に対して以下を流し直す (リポジトリのマイグレーションにはしない。
  本番は古いデフォルト権限で作られており不要なため):
  `grant all on all tables in schema public to anon, authenticated, service_role;`
  を実行したうえで、`20260720000000` と `20260820000000` の revoke / grant 部分を再適用する。
  なお `favorites` は環境差に依存しないよう、マイグレーション内で必要な権限を明示付与している。
