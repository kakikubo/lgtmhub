# タスクリスト: CI に Supabase Local を導入

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: CI ワークフローの改修

- [x] T1-1 `.github/workflows/ci.yml` の `e2e` ジョブから placeholder の `env:` ブロックを削除
- [x] T1-2 同ジョブに `supabase/setup-cli@v1` を追加 (version は明示: 2.0.0)
- [x] T1-3 `supabase start` ステップを追加
- [x] T1-4 `supabase status -o json` で取得した `API_URL` / `ANON_KEY` を `$GITHUB_ENV` に書き出すステップを追加
- [x] T1-5 `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` を空文字で job レベルに渡す (Supabase 起動時の warning 抑制)
- [x] T1-6 `supabase stop` を `if: always()` で末尾に追加 (cleanup, --no-backup 付き)
- [x] T1-7 ステップの順序が「supabase start → status 抽出 → playwright install → build → test:e2e → stop」になっていることを確認

## フェーズ 2: CI での動作確認

- [ ] T2-1 ブランチを push して CI を実行
- [ ] T2-2 `e2e` ジョブが緑になることを確認
- [ ] T2-3 ジョブログに `DATABASE_ERROR` / `[HomePage] failed to list images` / `[ImageDetailPage] failed to load image` が出ていないことを確認
- [ ] T2-4 失敗時は原因を切り分けて修正し、再 push する

## フェーズ 3: ドキュメント更新

- [x] T3-1 `docs/development-guidelines.md` の「CI/CDパイプライン」節 (もし `e2e` ジョブの説明があれば) を更新
- [x] T3-2 `.github/workflows/ci.yml` 内のコメント (lines 46-51 にあった placeholder の説明) を実情に合わせて書き換え

## フェーズ 4: 振り返り

- [ ] T4-1 本ファイル末尾の「実装後の振り返り」を更新
  - 実装完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
{YYYY-MM-DD}

### 計画と実績の差分

**計画と異なった点**:
- (実装後に記入)

**新たに必要になったタスク**:
- (実装後に記入)

**技術的理由でスキップしたタスク**(該当する場合のみ):
- (該当なしなら「該当なし」と書く)

### 学んだこと

**技術的な学び**:
- (実装後に記入)

**プロセス上の改善点**:
- (実装後に記入)

### 次回への改善提案
- (実装後に記入)
