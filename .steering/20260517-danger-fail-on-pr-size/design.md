# 設計: Danger PR 行数チェックのエラー化

## 方針

既存 `dangerfile.ts` の構造（`INCLUDE_PREFIXES` / `EXCLUDE_PATTERNS` /
`isProductionFile` / `countDiffLines` / `run`）をそのまま踏襲し、差分を最小化する。
新規ファイル・新規依存は追加しない。

## 変更点

### 1. `dangerfile.ts`

| 箇所 | 変更前 | 変更後 |
|---|---|---|
| import | `import { danger, warn } from 'danger';` | `import { danger, fail, warn } from 'danger';` |
| `LINE_THRESHOLD` | `300` | `500` |
| `EXCLUDE_PATTERNS` | 4 パターン | 末尾に `/\.mdx?$/i`（markdown 除外）を追加 |
| 行数超過時 | `warn(...)` | `fail(...)` |
| 行数超過メッセージ | 「推奨上限 300 行を超えています。分割を検討してください。例外は PR 説明欄に記載」 | 「上限 500 行を超えています。PR を分割してください。」（ブロッキング前提の文言へ） |
| ファイル数超過時 | `warn(...)` | 変更なし（`warn()` のまま） |

`fail()` を選ぶ理由: `danger.yml` が `npx danger ci --failOnErrors` を実行しているため、
`fail()` が 1 件でもあれば danger CLI が非ゼロ終了し、Danger ジョブが赤くなる。
workflow 側の変更は不要。

markdown 除外を `EXCLUDE_PATTERNS` に置く理由: `isProductionFile` は
「INCLUDE_PREFIXES に一致 かつ EXCLUDE_PATTERNS に不一致」で判定しているため、
`/\.mdx?$/i` を 1 行足すだけで行数・ファイル数の両集計から自動的に除外される。
`i` フラグで `.MD` 等の大文字も対象。`?` で `.md` と `.mdx` の両方をカバー。

### 2. `.github/workflows/danger.yml`

変更不要。既に `npx danger ci --failOnErrors` が設定済みで、`fail()` で
ジョブが失敗する。冒頭コメントの「計測対象・除外ルール・閾値は ... dangerfile.ts に集約」
という記述も新仕様で整合するため修正不要。

### 3. `docs/development-guidelines.md`

- 「PRの大きさの目安」: `変更行数: 300行以内` → `500行以内`、
  計測対象外リストに「markdown ファイル（`*.md` / `*.mdx`）」を追加、
  確認方法の `git diff --stat` 例にも markdown 除外を追記、
  「300行を超える場合は分割を検討する。例外は PR 説明欄に記載」→
  「500行を超える PR は Danger が CI を失敗させる。分割すること」へ更新。
- 「自動チェック（Danger）」サブセクション: warning → エラー（CI 失敗）に書き換え、
  閾値 500・markdown 除外を明記。
- CI/CD 章の「#### Danger（PR サイズ警告）」: タイトル/本文を
  「PR サイズチェック（エラー）」相当へ更新し、`fail()` でジョブが失敗する旨を記載。

## トレードオフ / 検討した代替案

- **ファイル数チェックも `fail()` 化する案**: Issue #114 は「PRの行数に対してエラー」と
  行数のみを明示。ファイル数は言及がないため最小影響で `warn()` 維持。
- **markdown 除外を `isProductionFile` に専用分岐で実装する案**: `EXCLUDE_PATTERNS`
  に正規表現を 1 行足すほうが既存パターンと一貫し、可読性・保守性が高い。後者を採用。
- **include スコープを撤廃し「全ファイル − markdown」で集計する案**: 既存設計
  （`app/` `src/` `components/` に限定し生成物/テスト/lockfile/migration を除外）は
  #15 の設計レビューを経たもの。Issue #114 はエラー化・閾値・markdown 除外のみ要求
  しており、スコープ撤廃は影響が大きく要求にも含まれないため不採用。

## 検証方針

- 静的検証: `npm run lint`（biome） / `npm run typecheck`（tsc --noEmit、dangerfile.ts も対象）
  / `npm test`（既存テストへの非影響）。
- 動的検証: ローカル完全再現は困難。本 PR 自体が新ワークフローのスモークテストになる。
  必要に応じて `npx tsx`/`node` 等で `isProductionFile` の判定を手元確認する。
