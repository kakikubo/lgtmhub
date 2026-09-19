# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎて後回し」は禁止
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

## フェーズ1: `as` の排除

- [x] `src/services/image-service.ts` の Fisher-Yates スワップを一時変数に書き換える
  - [x] `as T` を削除する
  - [x] `noUncheckedIndexedAccess` 向けに undefined ガードを置く

- [x] `app/(site)/images/[id]/page.tsx` の catch から `as` を除く
  - [x] コールバックに `PublicLgtmImageDetail | null` の戻り値注釈を付ける
  - [x] `return null` のみにする

- [x] `src/lib/image/validate-image.ts` の `includes` から `as` を除く
  - [x] `readonly string[]` の widening 定数を追加する
  - [x] 型ガードのシグネチャは維持する

- [x] `src/lib/image/compose-lgtm.ts` の ArrayBuffer 変換から `as` を除く
  - [x] `new ArrayBuffer` + `Uint8Array.set` のローカル helper を追加する
  - [x] `cachedFont` のキャッシュは維持する

## フェーズ2: 品質チェック

- [x] すべてのテストが通ることを確認
  - [x] `pnpm run test`
- [x] リントエラーがないことを確認
  - [x] `pnpm run check`
- [x] 型エラーがないことを確認
  - [x] `pnpm run typecheck`
- [x] 規約外の `as` が残っていないことを確認
  - [x] `src/` `app/` `components/` を grep し、例外以外が 0 件であることを確認する

## フェーズ3: ドキュメント更新

- [x] README.md を更新（変更なし。規約は既存ドキュメントに既にある）
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-19

### 計画と実績の差分

**計画と異なった点**:
- 4 箇所とも `as` なしで書き換えられ、CLAUDE.md の例外リスト追記は不要だった
- ArrayBuffer は `Buffer.buffer.slice()` の narrowing ではなく、`new ArrayBuffer` へのコピーで回避した。フォントは `cachedFont` があるため初回 1 回だけ

**新たに必要になったタスク**:
- なし

**技術的理由でスキップしたタスク**（該当する場合のみ）:
- なし

### 学んだこと

**技術的な学び**:
- `noUncheckedIndexedAccess` 下の tuple 代入は各要素が `T | undefined` になり、`as T` で黙らせがち。一時変数 + undefined ガードの方が規約に沿う
- `as const` タプルの `includes` は searchElement がリテラルユニオンに狭まる。`readonly string[]` への widening 定数で型ガード実装を書ける
- Node の `Buffer.buffer` は `ArrayBufferLike` なので、`parse` が `ArrayBuffer` を要求すると `as` が誘発される。コピーすれば例外を増やさずに済む

**プロセス上の改善点**:
- Issue に書き換え方針が書いてあったため、steering は実装手順の固定に集中できた

### 次回への改善提案
- `as` が必要に見えたら、例外リスト追記の前に widening 定数・戻り値注釈・コピーで回避できないか確認する
- 検証対象外の `scripts/preview-lgtm-fonts.ts` に同じ ArrayBuffer キャストが残っている。本番 helper を切り出すタイミングで揃えてよい

