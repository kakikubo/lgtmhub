# タスクリスト

Issue #255 — `app/api` をカバレッジ計測対象に追加する

## フェーズ1: 計測範囲の変更

- [x] `vitest.config.ts` の `coverage.include` に `'app/api/**/*.ts'` を追加
- [x] `exclude` / `thresholds` を変更していないことを差分で確認（`git diff` で include 行 + コメントのみの変更を確認）

## フェーズ2: ローカル検証

- [x] `pnpm run test:coverage` を実行し、全テスト pass と既存 thresholds 通過を確認（21 files / 262 tests pass、exit=0）
- [x] `coverage/lcov.info` に `app/api` 配下の 6 route が `SF:` 行として出力されることを確認（`grep -c '^SF:app/api'` = 6）
- [x] `src/services/**` / `src/lib/**` のカバレッジ値が変更前と一致することを確認（services 96.58/98.27/87.09/100、lib 94.73/100/88.88/94.73 で変更前と同値）

## フェーズ3: 品質チェックと修正

- [x] `pnpm run check` (biome) が exit 0（変更ファイルを明示パスで検証。`pnpm` 自体はローカルの corepack shim 不整合で起動できないため `node_modules/.bin/biome` を直接実行）
- [x] `pnpm run typecheck` が exit 0（`node_modules/.bin/tsc --noEmit`）

## フェーズ4: ドキュメント更新

- [x] `docs/development-guidelines.md` L690 付近「カバレッジ目標」の `coverage` スニペットに `include` の実体を反映（`app/api/**` がゲート対象外である旨の補足も追加）
- [x] `docs/development-guidelines.md` L900 付近「集計対象」に計測範囲と `app/(site)` を含めない理由を追記

## フェーズ5: PR とフォローアップ

- [x] コミット・push・PR 作成（PR #256、`Closes #255`）
- [x] CI の `test` ジョブがグリーンであることを確認（全 10 チェック pass。Codecov アップロードも成功し 53,535 bytes を送信）
- [x] Codecov の PR コメントに `app/api` の route が現れることを確認（2026-07-19、#260 の GitHub App インストール後に `test` ジョブを再実行して達成）
  - PR コメント: `Files 20 → 26 (+6)` / `Coverage 94.52% → 89.48% (-5.04%)` / `All modified and coverable lines are covered by tests`
  - チェック: `codecov/project: success` / `codecov/patch: success`（commit status ではなく **check-run** として登録される）
  - **角括弧パスの検証完了**: route.ts はちょうど 6 本、うち 2 本が `[id]` を含む。`+6` は 6 本すべてが取り込まれたことを意味する
  - CI 実測 89.48% はローカル実測 89.63% と 0.15pt 差で、#113 記載の env 差の範囲内
- [x] フォローアップ Issue を 3 件起票
  - [x] e2e カバレッジ収集と `app/(site)/**` の計測 → #257
  - [x] `app/api/images/route.ts` のテスト補強（現状 34.88%）→ #258
  - [x] CI 実測後の `app/api/**` per-glob 閾値の検討 → #259
- [x] 検証中に判明した別問題を起票 → #260（Codecov GitHub App 未インストール）

## 実装後の振り返り

### 実装完了日

2026-07-18（Codecov コメントの確認のみ #260 の解決を待ち 2026-07-19 に完了）

### 実装サマリー

- `vitest.config.ts` の `coverage.include` に `app/api/**/*.ts` を追加（`exclude` / `thresholds` は不変）
- `docs/development-guidelines.md` の「カバレッジ目標」スニペットと「Codecov > 集計対象」を実体に同期
- ローカル検証: 21 files / 262 tests pass、`test:coverage` exit 0、biome / tsc exit 0、`lcov.info` に `app/api` の 6 route を確認
- CI: 全 10 チェック pass、Codecov アップロード成功（53,535 bytes）
- PR #256 / フォローアップ Issue #257・#258・#259・#260

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| バッジへの影響 | 当初「ほぼ動かない」と見積もった | **誤り**。実測で Lines 95.00% → 89.63%（5.4pt 下落）。`app/api/images/route.ts` の 34.88% が主因。計画段階で実測してから合意し直した |
| 完了条件の達成 | Codecov PR コメントで `app/api` を目視確認 | 一度**達成不能**に。Codecov GitHub App が未インストールで PR コメントが導入以来一度も投稿されていないことが判明し #260 に切り出し。翌 2026-07-19 にインストール後、`test` ジョブ再実行で達成（`Files +6`） |
| 診断の根拠 | — | #260 の根拠として挙げた「`codecov/*` の commit status が無い」は**誤り**。Codecov は legacy commit status ではなく check-run を使うため、`/commits/{sha}/status` では元々検出できない。有効な根拠は「過去 50 PR でコメント 0 件」の方だった |
| フォローアップ Issue | 3 件の予定 | 4 件（検証中に #260 が判明） |

### 学んだこと

1. **「導入済み」と「機能している」は別物**: Codecov は 2026-05-17 に導入され、CI アップロードもバッジも動いていたため稼働しているように見えたが、可視化の中核である PR コメントは 2 か月間まったく機能していなかった。アップロードは `CODECOV_TOKEN` で成立する一方、PR への書き込みは GitHub App の権限を要するという**二段構えの前提**を見落としていた。導入時の受け入れ条件に「実際に PR コメントが付くこと」を含めていれば初日に検出できた
2. **見積もりは実測で潰す**: 「テスト済みのファイルを足すのだからバッジは動かない」という推論は、1 ファイル（`images/route.ts` 34.88%）の存在で崩れた。計画段階で `include` を仮変更して実測したことで、合意前に前提を訂正できた。設定変更の影響は推論せず測る
3. **計測範囲は設定した瞬間から劣化しうる**: `coverage.include` は導入時に `src/**` で正しかったが、その後 `tests/unit/api/` が増えたことで実態とズレた。include は「今のディレクトリ構成」への依存であり、定期的に棚卸しが要る
4. **Codecov のステータスは check-run であって commit status ではない**: `/repos/{owner}/{repo}/commits/{sha}/status` では `codecov/project` / `codecov/patch` を検出できず、`/commits/{sha}/check-runs` を見る必要がある。連携の有無を API で判定する際にエンドポイントを誤ると、正しい結論に誤った根拠を付けてしまう
5. **v8 の text レポータと lcov は出力が一致しない**: `images/random/route.ts` は text の表に現れないが lcov には `SF:` 行として存在した。Codecov が読むのは lcov なので、検証はターミナル出力ではなく **lcov を直接見る**べき

### 次回への改善提案

1. ~~**#260 を最優先で解決する**~~（2026-07-19 完了。GitHub App インストール後、`test` ジョブの再実行でコメントとチェックが出るようになった。既存 PR に遡って投稿されるわけではなく、**新しいアップロードの発生が必要**な点に注意）
2. **外部 SaaS 連携の受け入れ条件に「実際に成果物が現れること」を含める**: 「CI が緑」「アップロード成功」は連携の成立を意味しない。今回の #260 はその典型
3. **`files:` 指定と自動探索の関係を確認する**: アップロードログに `Found 2 coverage files to report` とあり、`coverage-final.json` も拾われている。同一データのため実害は薄いと見られるが、#260 の解決後に挙動を確認したい
4. **`docs/development-guidelines.md` の既存ドリフト解消**: L838 のサンプルが `codecov-action@v5`（実体 `@v7`）、L902 が完了済みの手動セットアップを未着手 TODO として記載。前回の申し送りから継続して未対応
