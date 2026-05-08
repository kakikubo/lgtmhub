# タスクリスト: ホームページの auth/画像取得を並列化

## 実装タスク

- [x] T1. `components/home-content.tsx` の `HomeContent` 関数を `Promise.all` で並列化する (`design.md` の変更後コード参照)

## 検証タスク

- [x] V1. `./node_modules/.bin/biome lint app components src tests` 実行 → `Checked 61 files. No fixes applied.` (pass)
- [x] V2. `./node_modules/.bin/tsc --noEmit` 実行 → エラーなし (pass)
- [x] V3. `./node_modules/.bin/vitest run` 実行 → **153 / 153 pass**
- [x] V4. `implementation-validator` サブエージェントで品質レビュー (総合 4.8/5、重大な問題なし)

## ドキュメント / クローズアウト

- [x] D1. tasklist.md の「申し送り」セクションを記入

## 申し送り (振り返り)

### 実装完了日

2026-05-09

### 計画と実績の差分

- 計画通り 1 ファイル (`components/home-content.tsx`) の差分のみで完了
- design.md に提示した変更後コードと実装が完全一致 (スペックドリフトなし)
- `npm ci` 時に worktree の lefthook prepare が `core.hooksPath` 警告で exit 1 → ただし node_modules はインストール済みだったため lint/typecheck/test は実行可能だった (本実装には影響なし)

### 計測結果

本タスク内では TTFB / LCP の本番計測は未実施。Vercel preview / production deploy 後に Chrome DevTools MCP で実施予定 (Issue #64 完了条件として PR レビュー時に計測値を記録する)。

### 学んだこと

- 既存の並列化パターン (`app/(site)/images/[id]/page.tsx:60`) があったため、設計判断で迷う余地が少なかった。同種のリファクタは「まず既存パターン Grep」が効く
- `try/catch` の代わりに `Promise.all` + 個別 `.catch(() => null)` で graceful degrade を表現すると、`loadError` 判定が `result === null` の単一シグナルに集約できて読みやすい
- Server Component の純粋なロジック変更なので、既存 E2E (`tests/e2e/image-list.test.ts`) でリグレッション検出が十分機能する。Server Component 用ユニットテストの追加は不要だった

### 次回への改善提案

- TTFB の自動計測手段がない (現状は curl + Server-Timing ヘッダ手動仕込み)。将来 `Server-Timing` ヘッダを自動付与するミドルウェアを検討するなら、本タスクのような並列化リファクタの効果検証コストが下がる
- 詳細ページとホームページで類似の「auth + データ取得」並列化パターンが 2 箇所に出現した。3 箇所目が出てきたら共通ヘルパー (`fetchUserAndData`) 化を検討する
- worktree 環境の `npm ci` で lefthook prepare がエラー終了する点は、サブタスクの自動実行を妨げるため、worktree セットアップ手順 (CLAUDE.md or README) で `npm install --ignore-scripts` を案内するか、lefthook の `prepare` 失敗を許容するスクリプトに調整すると親切
