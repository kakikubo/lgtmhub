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

- [ ] 関心事ごとに分割してコミット
  - [ ] ワークフロー本体 (`.github/workflows/supabase-deploy.yml`)
  - [ ] 開発ガイドライン更新 (`docs/development-guidelines.md`)
  - [ ] ステアリング (`.steering/20260506-ci-supabase-db-push/`)
- [ ] `chore/ci-supabase-db-push` を origin に push
- [ ] PR を作成
  - [ ] PR 説明に必要 Secrets 3 種 (`SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` / `SUPABASE_PROJECT_REF`) と登録手順を明記
  - [ ] 動作確認の段取り（マージ後 `workflow_dispatch` 起動 → PR #35 の migration がリモート反映 → Vercel Preview で削除動作確認）を明記

## フェーズ6: 振り返り

- [ ] 実装後の振り返りを本ファイル下部に記録
  - [ ] 実装完了日
  - [ ] 計画と実績の差分
  - [ ] 学んだこと
  - [ ] 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
{YYYY-MM-DD}

### 計画と実績の差分

**計画と異なった点**:
- {計画時には想定していなかった技術的な変更点}

**新たに必要になったタスク**:
- {実装中に追加したタスク}

**技術的理由でスキップしたタスク**（該当する場合のみ）:
- {タスク名}
  - スキップ理由: {具体的な技術的理由}
  - 代替実装: {何に置き換わったか}

### 学んだこと

**技術的な学び**:
- {実装を通じて学んだ技術的な知見}

**プロセス上の改善点**:
- {タスク管理で良かった点}

### 次回への改善提案
- {次回の機能追加で気をつけること}
