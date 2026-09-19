# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### 実装可能なタスクのみを計画
- 計画段階で「実装可能なタスク」のみをリストアップ
- 「将来やるかもしれないタスク」は含めない
- 「検討中のタスク」は含めない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

### タスクが大きすぎる場合
- タスクを小さなサブタスクに分割
- 分割したサブタスクをこのファイルに追加
- サブタスクを1つずつ完了させる

---

## フェーズ1: timeout-minutes

- [x] `.github/workflows/ci.yml` の全ジョブに `timeout-minutes` を設定する
  - [x] lint-and-typecheck: 10
  - [x] test: 10
  - [x] e2e: 20
  - [x] security: 10
- [x] `.github/workflows/danger.yml` の danger ジョブに 10 を設定する
- [x] `.github/workflows/release-drafter.yml` の update_release_draft ジョブに 10 を設定する
- [x] `.github/workflows/_supabase-push.yml` の push ジョブに 10 を設定する
- [x] `.github/workflows/supabase-deploy.yml` の prod / preview に 10 を設定する
- [x] `.github/workflows/supabase-preview-migrate.yml` の push に 10 を設定する

## フェーズ2: Playwright キャッシュ

- [x] e2e ジョブに `actions/cache@v6` を追加する（`~/.cache/ms-playwright`、キーは OS + `pnpm-lock.yaml`）
- [x] キャッシュミス時は `pnpm exec playwright install --with-deps chromium`
- [x] キャッシュヒット時は `pnpm exec playwright install-deps chromium`

## フェーズ3: ドキュメント

- [x] `docs/development-guidelines.md` を更新する
  - [x] timeout-minutes の方針を書く
  - [x] Playwright キャッシュ（ヒット時は install-deps のみ）を書く
  - [x] サンプル YAML に timeout と cache ステップを反映する

## フェーズ4: 品質チェックと修正

- [x] `.github/workflows/` の全ジョブに `timeout-minutes` があることを grep で確認する
- [x] `pnpm run check` が通る
- [x] `pnpm run typecheck` が通る
- [x] `pnpm run test` が通る

## フェーズ5: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-19

### 計画と実績の差分

**計画と異なった点**:
- なし。timeout は全 10 ジョブ、e2e の cache miss/hit 分岐、guidelines の説明とサンプル追随、という計画どおりの差分になった
- ローカル検証はホストの Node 26 / pnpm ラッパーが engine 不一致で install を要求したため、mise の Node 24.18.0 から `node_modules/.bin` を直接実行した。結果は biome 136 files、tsc、vitest 43 files / 422 tests いずれも成功

**新たに必要になったタスク**:
- なし

**⚠️ 注意**: 「時間の都合」「難しい」などの理由でスキップしたタスクはここに記載しないこと。全タスク完了が原則。

### 学んだこと

**技術的な学び**:
- 再利用ワークフローの呼び出しジョブにも `timeout-minutes` を書ける。本体ジョブと呼び出し側の両方に付けると、内側の設定漏れでも全体が 6 時間走らない
- Playwright のブラウザ本体と OS パッケージはキャッシュ境界が違う。`~/.cache/ms-playwright` だけを `actions/cache` し、ヒット時は `install-deps` に分けるのが正しい
- `restore-keys` で古いブラウザを部分リストアするとバージョン不一致になるので、キーは lockfile ハッシュのみにする

**プロセス上の改善点**:
- Issue 本文の timeout 目安と「同一 PR で Playwright cache も可」を最初から requirements に含めたため、実装中の方針揺れがなかった

### 次回への改善提案
- e2e がまだボトルネックなら Docker / Supabase イメージのキャッシュを別 Issue にする
- この PR の 2 回目以降の e2e ログで cache hit と所要時間を確認し、必要なら timeout を実測へ寄せる
