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

## フェーズ1: 実装

- [x] `src/services/image-service.ts` に `BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` 定数を `export` で追加
  - [x] 定数値: `60 * 60 * 24 * 365` (1 年)
  - [x] 既存の `MAX_DAILY_UPLOADS` 付近に配置 (ファイル冒頭の export 群)

- [x] `defaultBlobClient.put` で `@vercel/blob` の `put()` に `cacheControlMaxAge` オプションを追加
  - [x] 既存の `{ access: 'public', contentType }` に `cacheControlMaxAge: BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` を加える

## フェーズ2: テスト更新

- [x] `tests/unit/services/image-service.test.ts` のアサーションを更新
  - [x] `BLOB_CACHE_CONTROL_MAX_AGE_SECONDS` を `import` する (定数の二重管理回避)
  - [x] `default BlobClient (@vercel/blob 委譲)` の `blobPut` 呼び出し検証 (line 374-378 付近) に `cacheControlMaxAge` を含める

## フェーズ3: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `npm test`
- [x] リントエラーがないことを確認
  - [x] `npm run lint` (`biome check` を変更ファイル指定で実行 — `biome.json` の `!**/.claude/worktrees` 除外により worktree 内で `npm run lint` が `path is ignored` を返すため明示パス指定で対応)
- [x] 型エラーがないことを確認
  - [x] `npm run typecheck`

## フェーズ4: ドキュメント更新

- [x] `docs/architecture.md` の「キャッシュ戦略」既存記述と整合していることを確認 (既に `public, max-age=31536000, immutable` と記載済み → 追記不要だが、今回の実装で実態に追いついたことを念頭に置く)
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-05-08

### 計画と実績の差分

**計画と異なった点**:
- 計画段階では想定していなかった `biome check` のインポート順 (`assist/source/organizeImports`) ルールに引っかかり、テストファイル冒頭の import 並びを再ソートする修正が 1 件発生した。設計書では import 追加までしか言及していなかったが、Biome の自動整列ルールを意識した順序で書く必要があった。
- `npm run lint` (= `biome lint .`) は worktree 内では `biome.json` の `!**/.claude/worktrees` 除外ルールに引っかかり「No files were processed」を返すため、変更ファイルを明示指定する `./node_modules/.bin/biome check <files>` 形式に切り替えて実行した。worktree 環境特有のワークアラウンド。

**新たに必要になったタスク**:
- テストファイルの import 並び順修正 (Biome assist/source/organizeImports に対応)。設計時の想定外だが、組織的には Biome のルールを通すこと自体は CI を通すための必須要件であり、追加コストは小さい。

**技術的理由でスキップしたタスク**:
- なし。全タスク完了。

### 学んだこと

**技術的な学び**:
- `@vercel/blob` v2 の `put()` は `cacheControlMaxAge` (秒) を直接引数に取り、これを未指定だと SDK デフォルトの 1 ヶ月で配信される。`Cache-Control` ヘッダ自体はエッジ側で組み立てられるため、`immutable` ディレクティブの強制は SDK では制御できない (Vercel 側仕様に委ねる)。
- `BlobClient` インターフェースを変更せずに、`defaultBlobClient` の内部実装だけにポリシー値を閉じ込めることで、DI されたカスタム `BlobClient` を使うテストへの影響を完全に避けられた。Service と Data Layer の責務分離が綺麗に効いた。
- `architecture.md` のキャッシュ戦略に「`public, max-age=31536000, immutable`」と記述済みでも、実装が追いついていない場合があるので、ドキュメント↔実装の整合性は機能追加のたびに確認した方がよい。今回はちょうど整合させる作業になった。

**プロセス上の改善点**:
- ステアリングファイル (requirements/design/tasklist) を先に書いてから着手したことで、スコープが小さくブレなかった。「既存画像 backfill」を最初からスコープ外と明記したことで、実装中に余計な検討で時間を取られずに済んだ。
- 既存テスト (`tests/unit/services/image-service.test.ts`) の構造を先に把握 (line 374-378 の `toHaveBeenCalledWith` を確認) してから実装したので、必要な修正箇所が 1 行で特定でき、実装と修正がほぼ同時進行で進んだ。

### 次回への改善提案
- worktree 環境では `npm run lint` がそのまま動かないので、開発ガイドラインかこの retrospective を参照して `./node_modules/.bin/biome check <files>` で代替する運用を周知するとよい。あるいは `package.json` の `lint` script を `biome lint --files-ignore-unknown=true .` のような形に整えるか、`biome.json` の除外ルールを `**/.claude/worktrees/**` のように明示パターンにすると worktree 内からの実行でも除外されないかもしれない (要検証)。
- 環境ヘッダの実値検証 (Issue 完了条件の curl 確認) は本 PR スコープ外としたが、本番反映後の運用タスクとして README か運用ドキュメントにチェックリスト化しておくと、Cache-Control 関連の変更時に毎回ヘッダを確認するワークフローが定着する。
