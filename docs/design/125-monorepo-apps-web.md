# Next.js アプリを apps/web へ移す monorepo 化 (#125 PR2)

## 結論
Next.js アプリ一式を `git mv` で `apps/web/` へ移し、pnpm workspace のパッケージ `@lgtmhub/web` にする。挙動は変えない。
ルートの `package.json` は workspace ルートとし、リポジトリ全体に効くツール（biome / lefthook / danger / markdownlint / supabase CLI）だけを持たせる。アプリ用スクリプトは `pnpm --filter @lgtmhub/web` に委譲し、`pnpm run check` などのコマンド名は変えない。CI と手元の手順をほぼそのまま使えるようにするため。
Vercel の Root Directory を `apps/web` に変える作業は、マージ直前に行う（手順は後述）。

## 設計

### 置き場所

| 置き場所 | 対象 |
|---|---|
| `apps/web/` へ移す | `app/` `components/` `src/` `public/` `tests/` `proxy.ts` `next.config.ts` `tsconfig.json` `vitest.config.ts` `playwright.config.ts` `components.json` `postcss.config.mjs` `global.d.ts` `next-env.d.ts` `vercel.json` `scripts/preview-lgtm-fonts.ts` |
| ルートに残す | `supabase/` `docs/` `.github/` `.devcontainer/` `pnpm-workspace.yaml` `pnpm-lock.yaml` `.npmrc` `biome.json` `lefthook.yml` `dangerfile.js` `codecov.yml` `renovate.json` `scripts/supabase-migrate-to-tokyo.sh` |

- `pnpm-workspace.yaml` の `packages` を `apps/*` に変える。`overrides` / `allowBuilds` / `minimumReleaseAge` は workspace 全体の設定なのでルートに残す
- 依存の振り分け: ルートの devDependencies は `@biomejs/biome` `lefthook` `danger` `markdownlint-cli2` `supabase`。それ以外は `apps/web` に移す
- `@/*` は引き続き「アプリのルート」を指す（`apps/web/tsconfig.json` の `./*`）。import 文は書き換えない

### 動作を変えないために直す箇所
- `next.config.ts`
  - `outputFileTracingRoot` を monorepo ルート（`../..`）に変える。pnpm の実体（`node_modules/.pnpm`）がルートに置かれるため
  - sharp の trace glob を `../../node_modules/.pnpm/...` に変える。外すと sharp 0.35 のとき（PR #187）と同じ `ERR_DLOPEN_FAILED` で `/api/images` が 500 になる
- `process.cwd()` を基準にしたパス（`compose-lgtm.ts` のフォント、e2e の storageState）はそのままにする。`--filter`、Vercel、Playwright のどれから起動してもプロセスは `apps/web` で動くため
- `db:types` はルートで実行し、出力先を `apps/web/src/types/database.types.ts` に変える
- `.env.local` は Next.js が読む `apps/web/` に置く（手元のファイルは各自で移す）
- CI ではパスだけを直す: Codecov の `files`、Playwright のレポート・成果物、`playwright install` の実行場所。Codecov への 2 ファイル送信（#263）は変えない
- パス前提の設定も合わせて直す: `biome.json`、`.gitignore`（`/` を含む 2 行）、`codecov.yml`、`dangerfile.js`、`release-drafter.yml` のラベル、`CLAUDE.md` / `AGENTS.md` / `docs/` のパス記述

### マージ手順（Vercel）
Root Directory はプロジェクト全体の設定なので、PR の中では変えられない。変更してからマージまでの間は、他のブランチのデプロイが失敗する。

1. CI が通り、レビューが済んだ状態にする
2. Vercel の Root Directory を `apps/web` に変える（「Include files outside the root directory」が有効であることも確認する）
3. この PR の Preview を再デプロイし、`/` と `/api/images` が 200 を返すことを確認する
4. すぐにマージし、本番でも 3 と同じ確認をする

戻すとき: revert PR をマージし、Root Directory を空に戻す。

## 検討した代替案
| 案 | 却下理由 |
|---|---|
| CI の各 step に `working-directory: apps/web` を付け、ルートにスクリプトを置かない | 変更行が増え、手元のコマンドも変わる。委譲スクリプトなら PR4 で `-r` に変えるだけで済む |
| Vercel の Root Directory はルートのままにして、`buildCommand` / `outputDirectory` で apps/web をビルドする | Next.js の自動検出から外れ、関数のトレースや出力の場所を独自に管理することになる |
| `@/*` を `apps/web/src` 基準に変える | 全ファイルの import を書き換えることになり、移動と無関係な差分で履歴が追えなくなる |
| biome をアプリごとに設定する | 対象のアプリは 1 つだけ。lefthook がルートの biome をそのまま使えるため、今は分けない |

## Non-goals
- `packages/shared` の切り出し（PR3）、`apps/api` の追加（PR4）
- Turborepo の導入、`tsconfig.base.json` の共通化（2 つ目のアプリができてから行う）
- 依存バージョンの更新、コードの挙動変更
