# 要求内容: Danger による PR 行数チェックをエラー化（閾値 500・markdown 除外）

## 関連 Issue

- [#114 Danger導入](https://github.com/kakikubo/lgtmhub/issues/114)

## 背景

2026-05-05 に [#15](https://github.com/kakikubo/lgtmhub/issues/15) 対応として
`dangerfile.ts` / `.github/workflows/danger.yml` による PR サイズチェックを導入済み。
現状は以下の仕様:

- 行数閾値: 300 行 / 挙動: `warn()`（警告コメントのみ、ブロックしない）
- 計測対象: `app/` `src/` `components/`、除外: `tests/` `database.types.ts` `package-lock.json` `supabase/migrations/`

Issue #114 は、この PR サイズチェックを「警告」から「エラー（CI 失敗）」へ強化し、
閾値を 500 行に引き上げ、markdown ファイルを計算対象外とすることを要求する。

## ゴール

PR の追加・変更行数（markdown を除く）が 500 行を超えた場合、Danger が `fail()` を出し、
GitHub Actions の Danger ジョブが失敗（赤）する。

## 機能要件

1. **エラー化**: 行数超過時の挙動を `warn()` → `fail()` に変更する。
   `.github/workflows/danger.yml` は既に `npx danger ci --failOnErrors` のため、
   `fail()` でジョブが失敗する（workflow 自体の変更は不要）。
2. **閾値 500 行**: `LINE_THRESHOLD` を 300 → 500 に変更する。
3. **markdown 除外**: `.md` / `.mdx` ファイルを計測対象から明示的に除外する
   （`EXCLUDE_PATTERNS` にパターンを追加）。
4. **メッセージ更新**: エラー化に合わせて文言を更新し、新しい閾値・参照リンクを含める。
5. **ドキュメント同期**: `docs/development-guidelines.md` の
   「PRの大きさの目安」「Danger（PR サイズ警告）」を新仕様に合わせて更新する。

## スコープ外

- 変更ファイル数チェック（10 ファイル）の挙動変更。Issue #114 は行数のみ言及のため
  `warn()` のまま維持する。
- 計測対象プレフィックス（`app/` `src/` `components/`）の見直し。
  既存の設計を踏襲する（markdown 除外は明示的に追加するが、それ以外の include/exclude は不変）。
- フォーク PR 対応、required check 化（ブランチ保護設定）は本 issue のスコープ外。

## 受け入れ基準

1. プロダクションコード（markdown を除く）の追加・変更行数が 500 行を超える PR で
   Danger が `fail()` を出し、Danger ジョブが失敗する。
2. `.md` / `.mdx` の変更行は行数集計・ファイル数集計のどちらにも含まれない。
3. 500 行以下の PR では `fail()` が出ない。
4. `npm run lint` / `npm run typecheck` / `npm test` がすべて通過する。
5. `docs/development-guidelines.md` の閾値・挙動・除外ルールが新仕様（500 行 / エラー /
   markdown 除外）と一致している。
