# タスクリスト: カバレッジ閾値の CI 常時ゲート化（Issue #113 / 案4）

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを `[x]` にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 未完了タスク (`[ ]`) を残したまま作業を終了しない

---

## フェーズ 1: vitest.config.ts の改修

- [x] T1-1 `enforceThresholds` 変数・`VITEST_DISABLE_THRESHOLDS` 参照・三項分岐を撤去し `thresholds` を常時適用
- [x] T1-2 `functions` 閾値を引き下げ（services 90→85 / lib 80→75）、branches/lines/statements は 90/80 据え置き
- [x] T1-3 冒頭コメントを「CI 含め常時ゲート / functions は CI 実測ベース調整」に書き換え

## フェーズ 2: ci.yml の改修

- [x] T2-1 `test` ジョブ `test:coverage` step の `env: VITEST_DISABLE_THRESHOLDS: "true"` を撤去
- [x] T2-2 設計意図コメントを「閾値は CI 含め常時ゲート」へ更新

## フェーズ 3: ドキュメント更新

- [x] T3-1 「カバレッジ目標」節の thresholds サンプルを新値へ更新し説明段落を最終仕様へ書き換え
- [x] T3-2 「CI/CDパイプライン > Codecov」節の `VITEST_DISABLE_THRESHOLDS` 記述撤去 + ci.yml サンプルを実体同期

## フェーズ 4: 検証

- [x] T4-1 `npm run test:coverage` 実行: 170 tests pass + 新閾値達成を確認（EXIT=0 / services 97.5/100/100/100・lib 90.9/90.9/91.07/91.07 で全閾値クリア）
- [x] T4-2 `VITEST_DISABLE_THRESHOLDS=true npm run test:coverage`: 閾値が無効化されない（旧挙動撤去）ことを確認（config に env 参照ゼロ＝構造的撤去、env=true でも EXIT=0 で閾値常駐評価）
- [x] T4-3 `npm run lint` 通過確認（`biome lint .` は biome.json の `!**/.claude/worktrees` 除外 × CWD が worktree 配下で `.` を ignore する worktree 固有既存事象。明示パス `biome lint src vitest.config.ts` は 22 files EXIT=0 clean。CI は非 worktree のため影響なし）
- [x] T4-4 `npm run typecheck` 通過確認（tsc --noEmit EXIT=0）
- [x] T4-5 `implementation-validator` サブエージェントで品質検証（総合 5.0/5・重大な問題なし・受け入れ条件全充足。提案1=design.md 精度統一を反映、問題1=docs ci.yml 版数ドリフトは 1PR1関心事のため別 PR・振り返りに明記）

## フェーズ 5: 振り返り

- [ ] T5-1 本ファイル末尾に「実装後の振り返り」を記載（完了日 / 計画と実績の差分 / 学んだこと / 次回への改善提案 / 申し送り）

---

- [x] T5-1 本ファイル末尾に「実装後の振り返り」を記載

## 実装後の振り返り

### 実装完了日
2026-05-18

### 実装サマリー

- `vitest.config.ts`: `VITEST_DISABLE_THRESHOLDS` / `enforceThresholds` / 三項分岐を撤去し `thresholds` を常時適用。`functions` のみ services 90→85 / lib 80→75 に引き下げ、branches/lines/statements は 90/80 据え置き。コメントを「CI 含め常時ゲート / functions は CI 実測ベース調整」に刷新
- `.github/workflows/ci.yml`: `test` ジョブ `test:coverage` step の `env: VITEST_DISABLE_THRESHOLDS: "true"` を撤去、設計意図コメント更新
- `docs/development-guidelines.md`: 「カバレッジ目標」節サンプル（4指標・新値）+ 説明段落、「CI/CDパイプライン > Codecov」節（VITEST_DISABLE_THRESHOLDS 撤去・採用/却下理由明記）、ci.yml サンプル `test` ジョブコメント同期
- 検証: `npm run test:coverage` EXIT=0 / 170 tests pass / 新閾値クリア（services 97.5/100/100/100・lib 90.9/90.9/91.07/91.07）。`VITEST_DISABLE_THRESHOLDS=true` でも閾値常駐評価（構造的撤去）。`typecheck` EXIT=0。`implementation-validator` 総合 5.0/5・受け入れ条件全充足

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| アプローチ選定 | Issue 4案を要検討 | ユーザー意思決定で案4採用（案1/2/3 を却下理由とともに記録）。推奨は案2だったがユーザーが品質基準維持を優先し案4を選択 |
| lint 検証 | `npm run lint` 通過確認 | `biome.json` の `!**/.claude/worktrees` 除外 × CWD が worktree 配下で `biome lint .` が `.` を ignore する **worktree 固有の既存事象**を特定。明示パス `biome lint src vitest.config.ts` で 22 files clean を確認し代替検証。CI は非 worktree のため無影響 |
| docs 修正範囲 | 該当節 + ci.yml サンプル同期 | validator 提案で design.md バッファ列の精度を統一（−3.23→−3.2pt）。ci.yml サンプルの版数ドリフト（@v4/postgres:16）は 1PR1関心事のため別 PR（下記改善提案）|

### 学んだこと

1. **env 切替フラグは「構造的撤去」が最強の証明**: `process.env.X` 参照をコードから完全に消すと、env を渡しても挙動が変わらないことが grep だけで証明できる。挙動テスト（env=true で green）は閾値が元々通る場合に「無効化された」と区別できないため、構造証明と併用するのが確実
2. **worktree 実行と biome の VCS ignore の相互作用**: `biome.json` が `!**/.claude/worktrees` を ignore に持つと、worktree 内から `biome lint .` を実行した瞬間 CWD 全体が ignore され「0 files」になる。`npm run lint` 失敗が実装起因か環境起因かを切り分けるには明示パス lint が有効
3. **approach 4 の安定性は「CI 実測フロアの下にバッファ」で担保**: 単純に CI 実測値ぴったりに下げるのではなく、観測点（88.23/77.5）の下に 2.5〜3pt のバッファを取ることで単一観測点に対する安定性を確保。ただし variance 自体は未解消で、これはユーザー承認済みトレードオフとして requirements/docs に明記した

### 次回への改善提案

1. **docs ci.yml サンプルの版数ドリフト解消（別 PR）**: `docs/development-guidelines.md` の ci.yml サンプルが `actions/checkout@v4` / `postgres:16` 等で実体（`@v6` / `postgres:18`）とずれている。前回 add-codecov 振り返りでも指摘済みの既知事象。本 PR では `test` ジョブのコメントのみ同期し版数は据え置き（1PR1関心事）。別 PR でサンプル全体を実体同期させると親切
2. **variance 再発時の対応経路を明確化**: 将来の Node マイナー更新で functions が観測済み（88.23/77.5）より大きく下振れし再 flaky 化した場合、案2（functions 除外）または案3（istanbul 化）への切替を別 Issue で再検討する。requirements.md のトレードオフ節を起点にできる
3. **CI での実測値モニタリング**: Codecov ダッシュボードで CI の functions 値の時系列を追い、85/75 のバッファが将来の Node 更新で侵食されていないか定点観測する運用を推奨

### 申し送り事項

1. **Codecov 側ゲート化は引き続きスコープ外**: `codecov.yml` は `informational: true` のまま（二重ゲート回避）。必須化が必要なら運用安定後に別 PR で検討（add-codecov 振り返りの申し送りを継続）
2. **docs ci.yml サンプル版数同期は別 PR**: 上記「次回への改善提案 1」参照。Issue 化推奨
3. **本変更はリポジトリ管理者の手動作業を要しない**: env 撤去 + 閾値調整のみで、GitHub/Codecov の管理画面操作は不要
