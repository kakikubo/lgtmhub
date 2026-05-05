# 要求内容: Danger による PR 変更行数チェックの導入

## 関連 Issue

- [#15 Danger による PR 変更行数チェックを GitHub Actions に導入する](https://github.com/kakikubo/lgtmhub/issues/15)

## 背景

`docs/development-guidelines.md` の「PRの大きさの目安」セクションで、以下の閾値を定めているが、現状はレビュー時の人手確認に依存している。

- 変更ファイル数: 10ファイル以内を推奨
- 変更行数: 300行以内を推奨（プロダクションコード）

レビュー前に開発者自身が気付ける仕組みを CI 上に用意し、ガイドライン遵守を支援したい。

## ゴール

PR 作成・更新時に GitHub Actions 上で Danger を実行し、プロダクションコードの追加・変更行数や変更ファイル数がガイドラインの閾値を超えた場合、PR コメントで warning を出す。

## 機能要件

### 計測対象（include）

`docs/development-guidelines.md` の「PRの大きさの目安」に準拠する。

- `app/` 配下の追加・変更行
- `src/` 配下の追加・変更行
- `components/` 配下の追加・変更行

### 計測対象外（exclude）

以下は閾値判定の集計から除外する。

- テストコード: `tests/`
- 自動生成ファイル: `src/types/database.types.ts`
- lockfile: `package-lock.json`
- マイグレーション SQL: `supabase/migrations/`

### 閾値と挙動

| 観点 | 閾値 | 超過時の挙動 |
| ---- | ---- | ---- |
| 追加・変更行数 | 300 行 | warning コメント |
| 変更ファイル数 | 10 ファイル | warning コメント（任意要件） |

- ブロックではなく warning に留め、例外的に大きい PR は PR 説明欄に理由を記載することでスルーできる運用を踏襲する。
- warning メッセージには「該当値」「閾値」「ガイドライン参照リンク」を含める。

## 非機能要件

- 実装言語は既存スタックと整合させる（TypeScript / Node.js v24）。
- GitHub Actions 上で `pull_request` イベント時に走らせる。
- 既存 CI（`ci.yml`）の lint / typecheck / test / e2e ジョブとは独立した workflow とし、既存ジョブの実行時間や障害範囲に影響を与えない。
- 必要な GitHub トークン権限は最小限に絞る（`pull-requests: write`）。

## スコープ外

- 行数超過時に PR をブロック（required check 化）すること。本 issue は warning のみ。
- 「変更ファイル数 10 超過」の超過理由レポート出力やラベル付与の自動化。
- Danger 以外の PR メタ情報チェック（タイトル prefix、説明欄テンプレート遵守 等）は別 issue で扱う。

## 受け入れ基準

1. PR を作成 / 更新したとき、`.github/workflows/danger.yml` が起動する。
2. プロダクションコードの追加・変更行数（`app/` `src/` `components/` から除外パターンを除いたもの）が 300 行を超える PR では warning コメントが付く。
3. プロダクションコードの変更ファイル数が 10 を超える PR では warning コメントが付く。
4. 閾値以下の PR では warning が付かない（OK 表示は無くてもよい）。
5. `npm run lint` / `npm run typecheck` / 既存テストはすべて通過する。
6. `docs/development-guidelines.md` に Danger による自動チェックが導入された旨が反映されている。
