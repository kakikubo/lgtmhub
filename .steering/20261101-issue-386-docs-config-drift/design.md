# 設計: docs の設定転記乖離解消

## 方針

設定値の正は設定ファイル。docs には「なぜそうしているか（方針・設計意図）」と、設定ファイルへのリンクだけを残す。
バージョン番号は Renovate で頻繁に変わるため、docs ではメジャー表記（`7.x` 等）に留め、パッチ・マイナーの値は書かない。

| 案 | 却下理由 |
|---|---|
| 全文コピーを実態に合わせて更新し続ける | Renovate のたびに再びずれる。今回の乖離の原因そのもの |
| docs 側をスクリプトで自動生成 | 仕組みが過剰。リンクで十分 |

## 変更箇所

- `docs/architecture.md`
  - 技術スタック表: TypeScript 7.x / pnpm 12.x / Node.js 24.x / Sharp 0.35.x / @supabase/ssr 0.12.x / @vercel/blob 2.x / zod 4.x
  - 「バージョン管理方針」: JSON ブロックを削除し、range 記法の方針（Next.js `~`、TypeScript `~`、他 `^`）を箇条書きで残す。`~16.2.0` 記述を削除
  - 注意事項の `@supabase/ssr v0.10 系` → `v0.10 以降`
- `docs/development-guidelines.md`
  - 前提環境表: TypeScript 7.x / pnpm 12.x / Node.js 24.x
  - GitHub Actions: YAML 全文を削除し、ジョブ構成表（ジョブ / 内容 / 設計意図）に置換
  - Codecov: `codecov-action@v5` → `codecov/codecov-action`（バージョンは ci.yml を正）、計測範囲に `components/**` を追加
  - package.json scripts: JSON 全文を削除し、リンクと要点（test:coverage が CI 本体、test:integration の `--passWithNoTests`）
- `docs/glossary.md`: Sharp 0.35.x
- `CLAUDE.md`: TypeScript 7.x
- `.github/workflows/danger.yml`: コメントの `dangerfile.ts` → `dangerfile.js`
