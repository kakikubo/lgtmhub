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

## フェーズ1: format 差分と biome.json の追随

- [x] `tests/unit/lib/image/compose-lgtm.test.ts` を `biome format --write` で整形する
- [x] `biome migrate --write` で `biome.json` を現行 CLI へ追随させる
  - [x] `$schema` が CLI バージョンと一致する
  - [x] `linter.rules.preset` が `"recommended"` である（`"none"` になっていない）
  - [x] 既存の個別ルール上書きが残っている

## フェーズ2: CI とドキュメント

- [x] `.github/workflows/ci.yml` の `pnpm run lint` を `pnpm run check` に変更する
- [x] `docs/development-guidelines.md` を更新する
  - [x] ローカル検証と CI を `pnpm run check` に揃える
  - [x] lefthook 節の「CI は format を検査しない」を実態に合わせる
  - [x] サンプル YAML と PR チェックリストを更新する
  - [x] `recommended` の記述を `preset` に合わせる

## フェーズ3: 品質チェックと修正

- [x] `pnpm run check` が exit 0 で、deserialize info が出ない
- [x] `pnpm run lint` が exit 0
- [x] `pnpm run typecheck` が exit 0
- [x] `pnpm run test` が通る

## フェーズ4: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-19

### 計画と実績の差分

**計画と異なった点**:
- なし。format 1 件、`biome migrate --write` の 2 キー変更、CI の 1 行置換、ガイドライン更新、という計画どおりの差分になった
- `biome migrate` は `$schema` を 2.5.13 に上げ、`recommended: true` を `preset: "recommended"` に置き換えた。`"none"` へ落ちる既知バグは再現しなかった

**新たに必要になったタスク**:
- なし

**⚠️ 注意**: 「時間の都合」「難しい」などの理由でスキップしたタスクはここに記載しないこと。全タスク完了が原則。

### 学んだこと

**技術的な学び**:
- `biome lint` と `biome check` は別ゲート。lint だけを CI に置くと、Biome マイナー更新後の format ドリフトが `main` に残る
- lefthook の staged 限定検査はコミット時の速度には効くが、未変更ファイルのドリフトは拾えない。リポジトリ全体の検査は CI が担う必要がある
- `biome migrate` は deprecated フィールドを機械的に直せる。手動書き換えより CLI 追随漏れが少ない

**プロセス上の改善点**:
- Issue 本文の対応案（format + CI の `check` 化）とコメントの migrate 案を最初から requirements に含めたため、実装中の方針揺れがなかった

### 次回への改善提案
- Biome の Renovate 更新 PR では `pnpm run check` 失敗時に format / migrate を同じ PR で直す運用を前提にする
- `$schema` は CLI のパッチバージョンに紐づくため、lockfile 更新のたびに schema 不一致 info が出うる。info を無視せず migrate する手順をメモしておく
