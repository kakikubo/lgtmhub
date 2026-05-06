# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ1: ワークフロー実装

- [x] `.github/workflows/supabase-deploy.yml` を新規作成
  - [x] ヘッダコメントで「main マージ時に supabase/migrations を自動 push」「PR #35 の事故が起点」を明記
  - [x] `on.push: branches: [main], paths: ['supabase/migrations/**']` を設定
  - [x] `on.workflow_dispatch:` を設定（手動再実行用）
  - [x] `permissions: contents: read` を設定（最小権限）
  - [x] `concurrency: { group: supabase-db-push, cancel-in-progress: false }` を設定
  - [x] job env で `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` を secrets から渡す
  - [x] `actions/checkout@v4` を最初に呼ぶ
  - [x] `supabase/setup-cli@v1` (`version: 2.98.0`) を呼ぶ
  - [x] `supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}` を呼ぶ
  - [x] `supabase migration list --linked` を呼ぶ（pending 出力）
  - [x] `supabase db push --linked` を呼ぶ

## フェーズ2: ワークフロー検証

- [x] `actionlint` または同等ツールで YAML 文法・Action バージョン・Secrets 参照を検証
  - [x] エラー 0 を確認（supabase-deploy.yml 単体で actionlint PASS。既存 ci.yml の SC2129 style 警告は本 PR スコープ外）
- [x] `paths` フィルタの挙動を文書化（design.md「データフロー」「CI 起動しないケース」に記載済み）

## フェーズ3: ドキュメント更新

- [x] `docs/development-guidelines.md` の `## CI/CDパイプライン > ### GitHub Actions` 末尾に `#### Supabase Migrations Auto Deploy` を追加
  - [x] 必要 Secrets 3 種を明記
  - [x] 失敗時の手動リカバリ (`npx supabase db push --linked`) を明記
- [x] `docs/development-guidelines.md` の `## 実装チェックリスト > ### マイグレーション追加時` を更新
  - [x] PR マージ後に自動反映される旨を追記
  - [x] post-update visibility 注記を追加（PR #35 の再発防止）

## フェーズ4: 品質チェック

- [x] `npm run check`（biome check . でエラー 0）
- [x] `npm run typecheck`（tsc --noEmit でエラー 0）
- [x] 既存の CI を壊していないことを git diff で確認（`.github/workflows/ci.yml` は無変更、新規追加は `supabase-deploy.yml` のみ）

## フェーズ5: コミット・PR 作成

- [x] 関心事ごとに分割してコミット
  - [x] ワークフロー本体 (`.github/workflows/supabase-deploy.yml`) — b08e0a7
  - [x] 開発ガイドライン更新 (`docs/development-guidelines.md`) — 75b7d45
  - [x] ステアリング (`.steering/20260506-ci-supabase-db-push/`) — 3f32823
- [x] `chore/ci-supabase-db-push` を origin に push
- [x] PR を作成 (#37)
  - [x] PR 説明に必要 Secrets 3 種 (`SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_REF`) と登録手順を明記
  - [x] 動作確認の段取り（マージ後 `workflow_dispatch` 起動 → PR #35 の migration がリモート反映 → Vercel Preview で削除動作確認）を明記

## フェーズ6: 振り返り

- [x] 実装後の振り返りを本ファイル下部に記録
  - [x] 実装完了日
  - [x] 計画と実績の差分
  - [x] 学んだこと
  - [x] 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
2026-05-06

### 計画と実績の差分

**計画と異なった点**:
- 計画通り。ワークフロー 51 行 + ドキュメント追記の最小構成で完結

**新たに必要になったタスク**:
- なし

**技術的理由でスキップしたタスク**:
- なし

### 学んだこと

**技術的な学び**:
- **`supabase db push` は SUPABASE_DB_PASSWORD を env 変数として自動参照する**: `--password` フラグでも渡せるが、CLI 引数はログに残るため env 経由が安全
- **`paths` フィルタは push トリガーで効く**: 本 PR のように workflow ファイル自身しか変えない PR では自動トリガーされない。これは意図通り（無関係な PR で本番 DB に push しないため）。代わりに `workflow_dispatch` で手動起動する設計にすることで動作確認の経路を確保できた
- **`concurrency.cancel-in-progress: false`**: マイグレーションは前方ロールが基本で部分適用が起きると面倒。後続を待たせる設計が安全。`true` にしたい誘惑があるが、ここは false が正解
- **secrets と vars の使い分け**: `SUPABASE_PROJECT_REF` は厳密には公開情報だが、ハードコードを避け secrets に揃えると workflow YAML が綺麗になる。一方で「これは secret ではない」と PR 説明に明記する運用が必要
- **actionlint の存在**: ローカルで GitHub Actions YAML を文法・参照レベルで検証できる。事前検証によりレビュー往復が減る

**プロセス上の改善点**:
- PR #35 で「ローカル動作 = リモート動作」と思い込んで Test plan の手動確認項目を残したまま実装を完了させたのが本質的な事故原因。本 PR ではドキュメントに **手動確認の段取りを CI 側に移譲する設計** を盛り込み、再発を構造で防ぐ形にできた
- ステアリングを「マイグレーションを書いた → リモートに反映するまで」を 1 つの作業単位として捉えていれば、PR #35 の段階で検出できた可能性がある

### 次回への改善提案
- **PR テンプレートに「Supabase DB に変更がある場合の確認項目」を追加するのも一案**: 本 CI 整備後はマージで自動反映されるが、CI 失敗時に気付ける仕組みがあると更に堅い。Slack / GitHub の通知設定を別途検討
- **PR 段階での dry-run 表示**: 本 PR のスコープ外としたが、`db push --dry-run` の結果を PR コメントに自動投稿する CI を将来追加すると、レビュー時点で SQL を確認でき安心感が増す。フォーク PR の secrets 露出問題は `pull_request_target` または接続情報を Read-only に分離するなどで回避可能
- **既存 ci.yml の SC2129 警告**: 本 PR スコープ外だが、別タスクで `{ ...; ...; } >> "$GITHUB_ENV"` 形式に整理すると actionlint 全件 PASS にできる
