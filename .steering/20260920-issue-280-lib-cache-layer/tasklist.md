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

## フェーズ1: ファイル移動と import 更新

- [x] `src/lib/cache/list-home-images.ts` を `src/services/cache/list-home-images.ts` へ移動する
- [x] 本番コードの import を新パスへ更新する
  - [x] `components/home-content.tsx`
  - [x] `app/api/images/route.ts`
  - [x] `app/api/images/[id]/route.ts`
  - [x] `app/api/images/[id]/regenerate/route.ts`
- [x] 空になった `src/lib/cache/` を削除する

## フェーズ2: テスト

- [x] `tests/unit/services/cache/list-home-images.test.ts` を追加する
- [x] 既存テストの import / `vi.mock` パスを更新する
  - [x] `tests/unit/components/home-content.test.tsx`
  - [x] `tests/unit/api/images/create-route.test.ts`
  - [x] `tests/unit/api/images/list-route.test.ts`
  - [x] `tests/unit/api/images/delete-route.test.ts`
  - [x] `tests/unit/api/images/regenerate-route.test.ts`（コメント / next/cache モック）

## フェーズ3: ドキュメント

- [x] `docs/repository-structure.md` を更新する（ツリー、services / lib / components の依存、テスト対応表）
- [x] `docs/architecture.md` のキャッシュパスを更新する
- [x] `src/CLAUDE.md` と `app/api/CLAUDE.md` の参照パスを更新する

## フェーズ4: 品質チェック

- [x] `pnpm run check` が通る
- [x] `pnpm run typecheck` が通る
- [x] `pnpm run test` が通る
- [x] 現行 docs / ソース / テストに `src/lib/cache` が残っていない

## フェーズ5: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-20

### 計画と実績の差分

**計画と異なった点**:
- ロジック変更はなく、パス移動とドキュメント同期で完了した
- Biome の import 整列で、`@/src/lib/*` を `@/src/services/*` より前に置く必要があった

**新たに必要になったタスク**:
- なし

**⚠️ 注意**: 「時間の都合」「難しい」などの理由でスキップしたタスクはここに記載しないこと。全タスク完了が原則。

### 学んだこと

**技術的な学び**:
- `'use cache'` 境界は ImageService を呼ぶため lib に置けない。`src/services/cache/` に隔離すれば、通常の `*-service.ts` は `next/cache` 非依存のままにできる
- トップの静的シェルを保つため、`HomeContent`（RSC）側でキャッシュ境界を呼ぶ必要があり、クライアントコンポーネントの services 禁止とは分けて書く必要がある

**プロセス上の改善点**:
- Issue が案A/案Bを明示していたので、移動先と非対象（過去の `.steering/`）を最初に切れた

### 次回への改善提案
- `'use cache'` など特定レイヤーに置けない制約があるコードは、最初から依存先のレイヤーに置く
- キャッシュ境界を増やすときは `src/services/cache/` に並べ、lib へ戻さない
