# supabase/ 規約

- マイグレーション追加後は `pnpm run db:types` で src/types/database.types.ts を再生成し、
  同じコミットに含める
- 本番と Preview は別 Supabase プロジェクト。main マージで本番へ自動 deploy される。
  PR 段階で Preview に先行適用するには apply-preview-migration ラベルを使い、
  他の PR とは直列に適用する。PR を未マージで close した場合、Preview に適用済みの
  DDL は残るため revert マイグレーションで戻す。
  詳細: docs/development-guidelines.md の Preview migration フロー
