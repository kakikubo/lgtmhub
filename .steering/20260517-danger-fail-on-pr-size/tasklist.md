# タスクリスト: Danger PR 行数チェックのエラー化

## 実装タスク

- [x] `dangerfile.ts`: `fail` を import に追加する
- [x] `dangerfile.ts`: `LINE_THRESHOLD` を 300 → 500 に変更する
- [x] `dangerfile.ts`: `EXCLUDE_PATTERNS` に markdown 除外 `/\.mdx?$/i` を追加する
- [x] `dangerfile.ts`: 行数超過時を `warn()` → `fail()` に変更し、メッセージを新仕様に更新する
- [x] `docs/development-guidelines.md`「PRの大きさの目安」を 500 行 / エラー / markdown 除外に更新する
- [x] `docs/development-guidelines.md`「自動チェック（Danger）」を新仕様に書き換える
- [x] `docs/development-guidelines.md` CI/CD 章の Danger 節を新仕様に更新する

## 検証タスク

- [x] `npm run lint` が成功することを確認する（worktree パスが biome ignore のため `npm run lint` は `No files processed`。`dangerfile.ts` を分離環境で `biome check` し exit 0 を確認。CI はリポジトリルートで実行のため非影響）
- [x] `npm run typecheck` が成功することを確認する（tsc --noEmit / 0 errors）
- [x] `npm test` が成功することを確認する（170 passed / 既存テストへの非影響）
- [x] `isProductionFile` の判定（.md/.mdx が除外されること）を手元で確認する（11/11 PASS）
- [x] implementation-validator サブエージェントの検証をパスする（総合 5/5、Critical/High なし。Low 1 件＝git diff 例の補足を反映、Low 1 件＝`edited` トリガーはスコープ外で据え置き）
- [x] 振り返り（実装完了日 / 計画と実績の差分 / 学んだこと / 改善提案）を本ファイル末尾に追記する

---

## 振り返り

### 実装完了日

2026-05-18

### 計画と実績の差分

- 計画通り。`dangerfile.ts` の 4 点（import / 閾値 / markdown 除外 / fail 化）と
  `docs/development-guidelines.md` 3 箇所の更新で完了。
- `.github/workflows/danger.yml` は事前確認どおり変更不要（`--failOnErrors` 設定済）。
- 計画外対応: implementation-validator の Low 指摘を受け、`git diff` 例示コマンドに
  「目安であり正確な集計は dangerfile.ts に従う / tests・lockfile・migrations は
  パス指定で既に除外」の補足コメントを追加。

### 学んだこと

- `biome.json` が `"!**/.claude/worktrees"` を ignore するため、worktree 内
  （`.claude/worktrees/danger`）から `npm run lint` を実行すると全ファイルが
  対象外になり `No files were processed` になる。CI はリポジトリルートで
  checkout するため非影響。worktree での lint 検証は、ignore を外した分離環境で
  `biome check <file>` する必要がある。
- `--failOnErrors` 付き `danger ci` では `fail()` が 1 件でも CLI が非ゼロ終了
  するため、workflow を触らずに warn→fail へ切り替えるだけでブロッキング化できる。
- markdown 除外は `EXCLUDE_PATTERNS` に `/\.mdx?$/i` を 1 行足すだけで、
  `isProductionFile` の AND 条件により行数・ファイル数の両集計から自動除外される。

### 次回への改善提案

- `LINE_THRESHOLD`（dangerfile.ts）と「PRの大きさの目安」（development-guidelines.md）
  の値が乖離しないよう、ガイドライン該当セクションを変更した PR で Danger に
  「dangerfile.ts も更新したか？」を促す仕組みは将来検討余地あり（旧 #15 振り返りと同旨）。
- 行数 fail でブロックされる運用上、例外的に大きい PR の扱い（required check 除外、
  管理者マージ、分割徹底のいずれか）を運用ルールとして別途明文化するとよい。
- worktree からの `npm run lint` 不可は開発体験上の落とし穴。README か
  development-guidelines に「worktree では lint をリポジトリルートで実行」旨を
  追記する改善余地がある（本 issue スコープ外）。
