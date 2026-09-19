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

## フェーズ1: 設定

- [x] `pnpm-workspace.yaml` に `minimumReleaseAge: 1440` を追加する
- [x] `renovate.json` に npm の 24h と `internalChecksFilter: "strict"` を入れる
  - [x] `internalChecksFilter` をトップレベルに置く
  - [x] `matchDatasources: ["npm"]` のルールを集約ルールより前に置く
  - [x] 末尾の `all non-major npm dependencies` 集約を維持する

## フェーズ2: ドキュメント

- [x] `docs/development-guidelines.md` の Renovate 節に 24h ゲートを追記する
- [x] `docs/repository-structure.md` の `pnpm-workspace.yaml` 説明を更新する
- [x] `AGENTS.md` に 24h ゲートの短文を足す
- [x] `README.md` の pnpm 行を 12.x に直し、24h ゲートを足す

## フェーズ3: 品質チェックと修正

- [x] `pnpm --package=renovate dlx renovate-config-validator renovate.json` が成功する
- [x] `pnpm install --frozen-lockfile` が成功する
- [x] `pnpm run check` が通る
- [x] `pnpm run typecheck` が通る
- [x] `pnpm run test` が通る

## フェーズ4: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-19

### 計画と実績の差分

**計画と異なった点**:
- なし。pnpm / Renovate の 24h 明示とドキュメント更新に収まった
- ローカルの corepack pnpm 12.3.4 shim が壊れていたため、検証は mise の pnpm 11.13.0 + Node 24 で実施した。`pnpm install --frozen-lockfile` は供給チェーン検証を通過し、現行 lockfile は十分古いことを確認した

**新たに必要になったタスク**:
- なし

**⚠️ 注意**: 「時間の都合」「難しい」などの理由でスキップしたタスクはここに記載しないこと。全タスク完了が原則。

### 学んだこと

**技術的な学び**:
- pnpm 12 の `minimumReleaseAge` デフォルトと Renovate の週次 schedule は、片方だけだと lockfile が CI で拒否される
- `internalChecksFilter: "strict"` が無いと、冷却中の版でも PR が立ち CI が赤くなる
- `prCreation: "not-pending"` は CI が `pull_request` のみのリポジトリでは PR 無限延期のリスクがある

**プロセス上の改善点**:
- Issue の 3 案を「1+2、除外なし」に最初から固定したため、実装中の方針揺れがなかった

### 次回への改善提案
- npm の 72h unpublish 窓に合わせるなら、pnpm と Renovate の値を同時に変える
- corepack の pnpm shim が壊れている環境では `mise exec -- pnpm` で検証を続行できる
