# プロジェクトメモリ

## 技術スタック

- Next.js App Router (cacheComponents 有効) + Supabase + Vercel
- 開発環境: devcontainer / Node.js v24 / TypeScript 6.x
- パッケージマネージャー: pnpm (Corepack 経由、`package.json` の `packageManager` でバージョン固定)。npm・yarn は使わない
- lint/format は Biome、unit は Vitest、e2e は Playwright

## 検証コマンド

- `pnpm run check` (biome) / `pnpm run typecheck` / `pnpm run test`
- e2e はローカルでは .env.local を読み込んで実行する:
  `set -a; source .env.local; set +a; pnpm run test:e2e`
- コミット時は lefthook が biome を自動実行し、修正不能エラーがあると失敗する

## 全域の規約

- パスエイリアス `@/*` はリポジトリルート起点 (例: `@/src/lib/errors`, `@/components/ui/button`)
- as キャストと any は使わない。unknown + 型ガードで絞り込む。例外は
  database.types.ts 由来の型の絞り込みとテストのモック値のみ
  (詳細: docs/development-guidelines.md)
- レイヤー依存は app → src/services → src/repositories, src/lib の単方向。
  route handler の書き方は app/api/CLAUDE.md、src 内の規約は src/CLAUDE.md を参照

## スペック駆動開発

- docs/ が「何を作るか」の北極星、`.steering/[YYYYMMDD]-[タスク名]/` が作業単位の計画
  (requirements.md / design.md / tasklist.md)
- 作業計画・実装・振り返りは steering スキルを使用する
  (モード1: 計画、モード2: 実装と tasklist.md 更新、モード3: 振り返り)
- docs/ のドキュメントは1ファイルずつ作成し、ユーザーの承認を得てから次に進む
- 実装前に関連する docs/ を読み、Grep で既存の類似実装を確認してから着手する

## ドキュメント

- 要求と機能: docs/product-requirements.md, docs/functional-design.md
- 技術と構造: docs/architecture.md, docs/repository-structure.md, docs/development-guidelines.md
- 用語: docs/glossary.md
- 下書き・アイデア: docs/ideas/ (自由形式)
