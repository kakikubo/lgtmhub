## 概要

<!-- この PR で何を変更したか、なぜ変更したかを 2-3 行で記述 -->

## 関連 Issue

<!-- Closes #xxx / Refs #xxx -->

## チェック

- [ ] `supabase/migrations/**` または `supabase/config.toml` に変更がある場合、`apply-preview-migration` ラベルを付与した (Preview Supabase に即時適用される)
- [ ] 破壊的 DDL (`DROP COLUMN` 等) を含む場合、未マージで close するときの Preview DB 手動 revert 手順を本 PR に記載した
