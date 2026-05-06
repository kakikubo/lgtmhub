# 要求内容

## 概要

`supabase/migrations/` の変更を main マージ時に GitHub Actions から自動でリモート Supabase (`lgtmdb`) に push する CI を整備する。これによりローカルからの手動 `supabase db push` 漏れによるリモート DB との乖離 (PR #35 で顕在化) を防ぐ。

## 背景

PR #35 (画像論理削除の RLS 修正) で以下の問題が顕在化した:

- ローカル DB にはマイグレーション (`20260506000000_extend_lgtm_images_select_policy.sql`) が適用されたが、リモート Supabase には未適用のまま
- Vercel Preview / 本番のアプリは Vercel ビルドで動くが、Supabase の DDL は別経路 (`supabase db push`) でしか反映されない
- 結果、Vercel Preview で同じ RLS エラーが発生し続けた

`supabase migration list --linked` の出力例:

```
Local          | Remote
20260506000000 |        ← 未適用
```

GitHub Actions に DB push を組み込むワークフローは存在せず、リモート DB 反映は手動運用に依存している。手動運用は属人化と漏れリスクが高い。

## 実装対象の機能

### 1. 自動 DB push ワークフロー

- main ブランチへの push で `supabase/migrations/**` に変更があれば自動で `supabase db push` を実行する
- 手動再実行のため `workflow_dispatch` も受け付ける
- 並走による競合を避けるため `concurrency` で直列化する
- 必要な GitHub Secrets:
  - `SUPABASE_ACCESS_TOKEN`: Supabase アカウントの個人アクセストークン (CLI 認証用)
  - `SUPABASE_DB_PASSWORD`: リモート DB のパスワード (`db push` 認証用)
  - `SUPABASE_PROJECT_REF`: リンク先プロジェクト ref (`szjjdsagnitpmzbbtfoy`)

### 2. 開発ガイドライン更新

- `docs/development-guidelines.md` (または同等のドキュメント) に「マイグレーション運用」セクションを追加
  - ローカル: `supabase migration up` / `supabase db reset`
  - リモート: main マージで自動反映 (本 CI)
  - 失敗時の手動リカバリ手順 (`supabase db push --linked` をローカルから実行)

## 受け入れ条件

### 自動 DB push ワークフロー

- [ ] `.github/workflows/supabase-deploy.yml` が新規作成される
- [ ] main 以外のブランチ push では実行されない
- [ ] `supabase/migrations/**` 以外の変更だけの push では実行されない
- [ ] `workflow_dispatch` で手動実行できる
- [ ] `concurrency` 設定で並走時は直列化される
- [ ] secrets 未設定時は明確に失敗する (silent skip しない)
- [ ] PR #35 マージ後、ワークフローが起動して `20260506000000` がリモートに反映される
- [ ] 反映後、Vercel Preview の画像削除フローが正常終了する

### 開発ガイドライン

- [ ] マイグレーション運用フローがドキュメント化されている
- [ ] 開発者が「ローカルで作って → CI が反映してくれる」と理解できる粒度

## 成功指標

- 今後 `supabase/migrations/**` を含む PR をマージすると自動でリモート DB に反映される
- ローカル / リモートの DDL ズレに起因する Preview / 本番の不具合が起きなくなる
- 「リモート DB に手動で push し忘れた」エラーが運用ドキュメントから根絶される

## スコープ外

- PR 段階での `db push --dry-run` 実行 (リモート接続が必要、シークレット PR 露出のリスクあり)。将来課題として記録
- Storage / Edge Functions のデプロイ自動化 (本 PR は migrations のみ)
- `db reset` / `db pull` の自動化 (破壊的または読み取り操作なので CI 化しない)
- 失敗時のロールバック自動化 (Supabase migrations は前方ロール専用が基本。ロールバック用マイグレーションは人間が書く)

## 参照ドキュメント

- `docs/development-guidelines.md` - 開発ガイドライン
- `.github/workflows/ci.yml` - 既存 CI (supabase/setup-cli@v1 の使い方リファレンス)
- `supabase/config.toml` - Supabase プロジェクト設定
- 関連 PR: #35 (画像削除 RLS 修正、本問題の発火点)
