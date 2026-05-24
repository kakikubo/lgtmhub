# requirements.md

## 背景

GitHub Issue [#143](https://github.com/kakikubo/lgtmhub/issues/143)

`npm run db:start` (= `supabase start`) 実行時に、特定の状態でローカル DB の Docker volume と CLI が管理する migration 履歴が不整合になると、以下のエラーで起動が止まり、ローカル開発が継続不能になる。

```
Applying migration 20260503000000_create_user_profiles.sql...
ERROR: relation "user_profiles" already exists (SQLSTATE 42P07)
```

## 根本原因(調査結果)

`supabase stop`(デフォルト=`--no-backup` なし)は Docker volume `supabase_db_lgtmhub` をバックアップとして保持する。次の `supabase start` は volume の状態に応じて挙動が変わる:

| volume の状態 | `supabase start` の挙動 |
|---|---|
| volume が存在 + 整合性あり | `Starting database from backup...` → マイグレーション再適用なし |
| volume が存在 + 不整合(例: `supabase_migrations` schema 欠落 / 手動操作後の中途状態) | `Initialising schema...` → 既存テーブルと衝突して 42P07 |
| volume が無い(新規 or `--no-backup` で停止後) | `Starting database... Initialising schema...` → migrations を順次適用 |

ローカル検証で上記の遷移を確認済み(`supabase stop --no-backup` で volume を削除した後 `supabase start` を実行すると正常にマイグレーションが適用される)。

## 解決方針

CLI 側の挙動を上書きすることはできないため、「ハマったときに volume を確実に捨てて作り直す」標準手順を提供する。具体的には以下を行う:

1. `package.json` に Docker volume ごと作り直すための便宜スクリプト `db:nuke` を追加する。
2. README のトラブルシュート章に「`relation "user_profiles" already exists` が出たときの復旧手順」節を追加する。

## 受け入れ条件

- 何らかの状態で `npm run db:start` が `relation ... already exists` で失敗した状況から、README のトラブルシュートに従うだけでローカル DB が初期状態に戻り、マイグレーションが正常適用されること。
- `npm run db:nuke` 実行後に Docker volume(`supabase_db_lgtmhub` / `supabase_storage_lgtmhub`)が消えていること。
- 既存の `db:start` / `db:stop` / `db:reset` などのスクリプトの挙動は変更しないこと(非破壊な追加)。
- `npm test` / `npm run lint` / `npm run typecheck` が green。

## 非要件 (Out of scope)

- Supabase CLI 本体の bug 修正(upstream issue は別途参照のみ)。
- CI 構成(`.github/workflows/ci.yml`)の変更は今回行わない。CI では既に `supabase stop --no-backup` が使われており、本問題は発生しない。
- マイグレーション SQL ファイル自体への `IF NOT EXISTS` 等の追加は行わない。原因が migration ファイルではなく volume 由来であることが調査で判明したため。
