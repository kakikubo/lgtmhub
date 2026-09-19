# AGENTS.md

Cursor / Cloud Agent 向けの常時適用ルール。詳細なプロジェクト規約は `CLAUDE.md` と `docs/` を正とする。

## 言語

- ユーザーへの返答・説明・コミットメッセージ・PR 説明は、特に指定がない限り**日本語**で書く
- コード・識別子・API・ファイルパス・コマンド・既存の英語ドキュメント見出しは英語のまま（既存スタイルに合わせる）
- ユーザーが英語で指示したターンは、そのターンに限り英語で返答してよい

## 必読ドキュメント

作業前に状況に応じて読む:

| 用途 | パス |
|------|------|
| プロジェクトメモリ（スタック・検証・層依存） | `CLAUDE.md` |
| 要求 / 機能 | `docs/product-requirements.md`, `docs/functional-design.md` |
| 技術 / 構造 | `docs/architecture.md`, `docs/repository-structure.md`, `docs/development-guidelines.md` |
| 用語 | `docs/glossary.md` |
| API / src 局所規約 | `app/api/CLAUDE.md`, `src/CLAUDE.md` |
| 作業単位の計画 | `.steering/[YYYYMMDD]-[タスク名]/` + `.claude/steering/SKILL.md` |

## 技術スタック（要約）

- Next.js App Router (`cacheComponents` 有効) + Supabase + Vercel
- Node.js v24 / TypeScript / パッケージマネージャは **pnpm のみ**（npm・yarn 不可）
- lint/format: Biome / unit: Vitest / e2e: Playwright

## 検証コマンド

```bash
pnpm run check      # biome
pnpm run typecheck
pnpm run test
# e2e（ローカルは .env.local を読み込む）
set -a; source .env.local; set +a; pnpm run test:e2e
```

コミット時は lefthook が biome を自動実行する。修正不能エラーがあると失敗する。

## 全域の規約（要約）

- パスエイリアス `@/*` はリポジトリルート起点
- `as` キャストと `any` は使わない。`unknown` + 型ガードで絞り込む（例外は `database.types.ts` 由来とテストモックのみ。詳細は `docs/development-guidelines.md`）
- レイヤー依存は `app` → `src/services` → `src/repositories`, `src/lib` の単方向
- docs/ のドキュメントは1ファイルずつ作成し、ユーザー承認後に次へ進む
- 実装前に関連 docs を読み、Grep で類似実装を確認してから着手する

## コミット / PR

- コミットメッセージの1行目は日本語で簡潔に（詳細は `docs/development-guidelines.md`）
- `main` へ直接コミットしない。PR 経由とする
- `Co-Authored-By` 行は付けない

## Cursor Cloud specific instructions

- 依存は `pnpm`（Corepack）。`pnpm install` 済みの環境を前提にする
- 秘密情報は `.env.local` / `supabase/.env`。未設定なら `.env.example` / `supabase/.env.example` を参照し、不足は推測で埋めない
- ローカル DB: `pnpm run db:start` → `pnpm run db:reset` → `pnpm run db:types`（スキーマ変更時は型再生成を同じコミットに含める）
- 開発サーバー: `pnpm run dev`（既定ポート 3000）
- UI 変更の検証はブラウザ操作で行い、証跡を残す。ターミナルのみで足りる変更は unit / typecheck / biome で十分
- Supabase / Docker が使えない Cloud 環境では、DB 依存の e2e を無理に回さず、unit / typecheck / 静的検証を優先し、ブロッカーを明示する
