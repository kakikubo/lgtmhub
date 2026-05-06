# 設計書

## アーキテクチャ概要

GitHub Actions 上の単一ワークフローで、main ブランチへのマージ時に `supabase/migrations/**` 配下を Supabase CLI を用いてリモート Supabase へ反映する。

```
[開発者] → PR → main マージ
                   │
                   ▼
       (paths: supabase/migrations/**)
                   │
                   ▼
   GitHub Actions: supabase-deploy.yml
   ┌────────────────────────────┐
   │ 1. checkout                 │
   │ 2. setup-cli v2.98.0        │
   │ 3. supabase link --project-ref│
   │ 4. (informational) migration list │
   │ 5. supabase db push          │
   └────────────────────────────┘
                   │
                   ▼
        Supabase Cloud (lgtmdb)
```

E2E ジョブは Docker で **ローカル** Supabase を起動するためリモートには触らない。本ワークフローはリモート専用、独立したファイルとして配置する。

## コンポーネント設計

### 1. `.github/workflows/supabase-deploy.yml`

**責務**:
- main ブランチで `supabase/migrations/**` に差分があるとき、リモート Supabase に新規マイグレーションを適用する
- `workflow_dispatch` で手動再実行を可能にする (障害復旧・リトライ用)

**実装の要点**:

- `on.push`:
  - `branches: [main]`
  - `paths: ['supabase/migrations/**']`
- `on.workflow_dispatch`: 引数なし
- `permissions`: `contents: read` のみ。push する先は GitHub ではなく Supabase なので書き込み権限不要
- `concurrency`:
  - `group: supabase-db-push`
  - `cancel-in-progress: false` (実行中の push を途中で殺すと部分適用になる)
- `env` (job レベル):
  - `SUPABASE_ACCESS_TOKEN`: `supabase` CLI の認証 (Supabase Cloud API)
  - `SUPABASE_DB_PASSWORD`: `db push` のリモート DB 接続認証
- ステップ:
  1. `actions/checkout@v4`
  2. `supabase/setup-cli@v1` (`version: 2.98.0` — 既存 CI と同一)
  3. `supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}`
  4. `supabase migration list --linked` (情報出力。ログから何が pending かを残す)
  5. `supabase db push --linked` (実適用)

**ステップ 3 (`link`) を経由する理由**:
- `supabase/.temp/project-ref` は `.gitignore` 配下でリポジトリには無い
- `db push --linked` は事前に link が必要
- `--db-url` 直接指定は接続文字列を secrets に置く必要があり、二重管理になる

**`SUPABASE_DB_PASSWORD` を env で渡す理由**:
- `--password` フラグでもよいが、トラブル時のログで誤って表示される事故を避けるため env 経由
- `db push` は `SUPABASE_DB_PASSWORD` を自動で参照する仕様

### 2. `docs/development-guidelines.md` 更新

**責務**: 「マイグレーション運用」を明文化する。

**更新箇所**:

#### a. `## CI/CDパイプライン > ### GitHub Actions` 末尾に Supabase デプロイの説明を追加

```markdown
#### Supabase Migrations Auto Deploy

`.github/workflows/supabase-deploy.yml` で main マージ時に `supabase/migrations/**` の差分をリモート Supabase (`lgtmdb`) に自動 push する。
- 必要な GitHub Secrets: `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_REF`
- `concurrency` で直列化、失敗時は `workflow_dispatch` から再実行可
- 失敗時の手動リカバリ: ローカルから `npx supabase db push --linked`
```

#### b. `## 実装チェックリスト > ### マイグレーション追加時` を更新

```markdown
1. `supabase db diff` で差分を確認してからマイグレーションファイルを作成
2. ローカルで `npm run db:reset` して正常適用を確認
3. RLSポリシーを必ず設定する。SELECT ポリシーが状態カラム (`status` 等) に依存する場合、
   状態遷移先が SELECT 可視性を満たすか確認する (post-update visibility check)
4. `npm run db:types` で型定義を再生成してコミットに含める
5. PR をマージするとリモートには `.github/workflows/supabase-deploy.yml` が自動反映する。
   失敗時は Actions ログを確認し、ローカルから `npx supabase db push --linked` で手動リカバリ
```

(ステップ 3 の post-update visibility 注記は今回の不具合の再発防止として併せて入れる)

## データフロー

### 通常フロー (PR マージ → リモート反映)

```
1. 開発者が supabase/migrations/<timestamp>_*.sql を含む PR を作成
2. CI (lint / test / e2e / security) が PASS
3. main にマージ
4. supabase-deploy.yml が paths フィルタにマッチして起動
5. setup-cli → link → migration list (ログ) → db push
6. リモート Supabase に新規マイグレーションが適用される
7. Vercel の次回 Preview / 本番デプロイで RLS が有効になる
```

### 手動再実行フロー

```
1. 自動実行が失敗 (例: secrets 未設定、リモート DB 接続不可)
2. 開発者が GitHub Actions UI から workflow_dispatch を起動
3. (secrets 修正後) 同じステップが再実行される
```

### CI 起動しないケース

- main 以外のブランチへの push: `branches: [main]` で除外
- main への push でも `supabase/migrations/**` が無修正: `paths` フィルタで除外
- (この除外は意図的。マイグレーション以外の PR で誤って push しない)

## エラーハンドリング戦略

| ケース | 検出 | 対応 |
|---|---|---|
| Secrets 未登録 | `supabase link` / `db push` がエラー終了 | Actions が Fail。Slack/Email 通知は GitHub 標準設定に委ねる |
| 部分適用 (途中失敗) | exit code 非 0 | 適用済みの migration はリモートの `supabase_migrations.schema_migrations` に記録される。後続の手動 `db push` で続きから適用 |
| 並走 | `concurrency` で直列化 | 直列化 |
| マイグレーションの SQL エラー | exit code 非 0 | PR 段階のローカル `db reset` で検出済みであるべき。リモート固有問題は手動リカバリ |

## テスト戦略

### 動作確認

GitHub Actions の workflow は手元では完全再現できないため:

1. **YAML 構文検証**: `actionlint` (npx 経由) または `yamllint` で文法チェック
2. **Path フィルタの確認**: `git log --name-only` でこのワークフロー自体は migrations 配下を変更しないため、本 PR をマージしても自動 push が走らないこと (一回目は `workflow_dispatch` で手動起動して動作確認)
3. **本動作確認**: secrets 登録後、PR #35 を main にマージ → `supabase-deploy.yml` が起動 → `20260506000000` がリモートに反映されることを確認

### 自動テスト

- 本ワークフロー自体に対するユニットテストは作らない
- Vercel Preview の手動確認は別 (PR #35 の責任範囲)

## 依存ライブラリ

新規追加なし。

- `supabase/setup-cli@v1` (既存 CI で使用中)
- `actions/checkout@v4` (既存 CI で使用中)

## ディレクトリ構造

```
.github/workflows/
  supabase-deploy.yml       ← 新規
  ci.yml                    ← 既存、無変更
  danger.yml                ← 既存、無変更
  release-drafter.yml       ← 既存、無変更

docs/development-guidelines.md  ← 一部更新

.steering/20260506-ci-supabase-db-push/  ← 本ステアリング
```

## 実装の順序

1. `.github/workflows/supabase-deploy.yml` を作成
2. `actionlint` で YAML 文法・Action バージョン・Secrets 参照を検証
3. `docs/development-guidelines.md` を更新 (CI/CD パイプライン と マイグレーション追加チェックリスト)
4. ブランチを push して PR 作成
5. ユーザーが GitHub Secrets を 3 種登録
6. PR をマージ → workflow_dispatch を手動起動して、リモート Supabase に PR #35 のマイグレーションが反映されること、Vercel Preview の削除フローが動くことを確認 (本検証は別タスクで PR #35 のフォローアップとして実施)

## セキュリティ考慮事項

### Secrets の取り扱い

- `SUPABASE_ACCESS_TOKEN`: Supabase アカウント全体に対する操作権限を持つ強力なトークン。漏洩時は即時無効化が必要。リポジトリ Secret として登録 (Environment Secret にすれば environment ごとに分離可能だが、Supabase プロジェクトは 1 つなので不要)
- `SUPABASE_DB_PASSWORD`: リモート DB のパスワード。PostgreSQL ユーザーの認証情報
- `SUPABASE_PROJECT_REF`: 公開 URL に含まれるため厳密には secret ではないが、設定値として secrets/vars に置くことで workflow YAML をハードコード地獄にしない。ここでは secret として揃える運用に統一

### permissions: contents: read

- 本 workflow は GitHub 側に書き込みしない。最小権限を明示する

### `pull_request` トリガーを使わない

- フォーク PR からのトリガーで secrets が露出するリスクを避ける
- main マージ後の `push` トリガーのみに限定することで、main にマージされた変更だけが secrets を使える

### concurrency=cancel-in-progress: false

- 実行中の `db push` を途中で殺すと、Supabase 側の `schema_migrations` に「適用済み」と記録された個々の migration は残る一方、後続が適用されない部分適用状態になる
- これを避けるため、後続が来ても先行を止めず、queue させる

## パフォーマンス考慮事項

- `db push` 自体は通常数秒〜数十秒。並走する他 CI に対する影響はほぼなし
- `paths` フィルタにより無関係な PR では起動しないため、Actions の月間消費分にも影響なし

## 将来の拡張性

- **PR 段階の dry-run**: PR 時に `supabase db push --dry-run` で適用予定の SQL をコメントする仕組み (CodeRabbit 的) を追加すると、レビュー段階で SQL を確認できる。ただしフォーク PR の secrets 問題と接続コストがあるため、別タスクで設計を切る
- **Storage / Edge Functions のデプロイ**: `supabase functions deploy` を別 job として追加可能。スコープ外
- **環境分離**: 開発用 Supabase / 本番用 Supabase を分けたくなった場合、`environment:` キーと Environment Secrets で対応可能。現状は単一プロジェクトなので不要
