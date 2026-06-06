# 設計: npm → pnpm 移行

## 全体方針

Corepack + `packageManager` フィールドでバージョンを固定し、ローカル / CI / Vercel の
3 環境で同一の pnpm バージョンを使う。コマンド書き換えは以下の対応表に従う。

| npm | pnpm |
|-----|------|
| `npm install` | `pnpm install` |
| `npm ci` | `pnpm install --frozen-lockfile` |
| `npm run <script>` | `pnpm run <script>` |
| `npx <bin>` | `pnpm exec <bin>`（ローカル依存）/ `pnpm dlx <bin>`（一時実行） |
| `npm audit` | `pnpm audit` |

## 変更対象ファイル

### パッケージ管理本体
- `package.json`: `"packageManager": "pnpm@10.4.1"` を追加
- `package-lock.json`: 削除
- `pnpm-lock.yaml`: `pnpm install` で生成
- `.npmrc`: pnpm 設定（`pnpm install` で build script が無視された依存は
  `package.json` の `pnpm.onlyBuiltDependencies` に明示追加する）

> pnpm 10 はデフォルトで依存の postinstall/build スクリプトを実行しない。
> `sharp` / `esbuild` / `@biomejs/biome` / `lefthook` / `supabase` などビルドスクリプトを
> 持つ依存は `pnpm.onlyBuiltDependencies` への登録が必要。`pnpm install` のログで
> "Ignored build scripts" を確認し、必要なものだけ許可する。

### CI（GitHub Actions）
- `.github/workflows/ci.yml`: 全 4 ジョブ（lint-and-typecheck / test / e2e / security）
  - `pnpm/action-setup@v4` を `actions/setup-node` の前に追加
  - `cache: "npm"` → `cache: "pnpm"`
  - `npm ci` → `pnpm install --frozen-lockfile`
  - `npm run ...` → `pnpm run ...`
  - `npx playwright install` → `pnpm exec playwright install`
  - `npm audit --audit-level=high` → `pnpm audit --audit-level high`
- `.github/workflows/danger.yml`: 同様 + `npx danger ci` → `pnpm exec danger ci`
- `.github/workflows/supabase-deploy.yml`: npm 不使用のため変更なし

### 開発環境
- `.devcontainer/devcontainer.json`: `postCreateCommand` を
  `"corepack enable && pnpm install"` に変更
- `lefthook.yml`: `npx biome` → `pnpm exec biome`
- `playwright.config.ts`: webServer command を `pnpm run start` / `pnpm run dev` に
- `scripts/preview-lgtm-fonts.ts`: 実行手順コメントを pnpm に

### Vercel
- `vercel.json`: install/build コマンドの明示指定なし。Vercel は `pnpm-lock.yaml` と
  `packageManager` フィールドから pnpm を自動検出するため**変更不要**。
  （セキュリティヘッダ / region のみの設定で、パッケージマネージャ非依存）

### ドキュメント
- `README.md`: `npm install` / `npm run *` を pnpm に
- `CLAUDE.md`（プロジェクト）: 「パッケージマネージャー: npm」→ pnpm
- `docs/architecture.md`: lefthook 説明 / npm audit 記述
- `docs/development-guidelines.md`: コマンド表記・CI YAML サンプル・チェックリスト
- `docs/repository-structure.md`: `npm run db:types` 表記

## 検証戦略

1. `pnpm install` 成功（lockfile 生成、build script 警告の解消）
2. `pnpm run lint` / `pnpm run typecheck` / `pnpm test` / `pnpm run build` がすべて成功
3. phantom dependency でビルド失敗した場合は当該パッケージを `dependencies` /
   `devDependencies` に明示追加して再検証
4. E2E（Playwright）と Vercel デプロイは push 後に CI / Vercel 上で確認（スコープ外、ユーザー操作）

## リスクと対策

- **phantom dependency**: 厳格解決で直接 import している未宣言パッケージが build で露見。
  → ログを見て `package.json` に明示追加。
- **build script 無視**: `sharp` 等のネイティブビルドが走らず実行時エラー。
  → `pnpm.onlyBuiltDependencies` に登録。
- **CI キャッシュ**: `cache: "pnpm"` は pnpm が先にセットアップされている必要あり。
  → `pnpm/action-setup` を `setup-node` の前に置く。
