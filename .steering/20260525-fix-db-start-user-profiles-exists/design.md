# design.md

## 変更スコープ

| ファイル | 種別 | 概要 |
|---|---|---|
| `package.json` | 修正 | `scripts` に `db:nuke` を追加 |
| `README.md` | 修正 | トラブルシュート章に `relation already exists` 節を追加 |
| `.steering/20260525-fix-db-start-user-profiles-exists/*` | 追加 | 本作業のステアリングファイル(履歴用) |

## package.json への追加

既存スクリプト構成に合わせ、`db:reset` の次行に追加する。**`supabase stop --no-backup` のみ**を実行し、続けて `db:start` するかは利用者判断とする(明示的な「volume 廃棄」コマンドにする):

```jsonc
{
  "scripts": {
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:nuke": "supabase stop --no-backup",
    "db:push": "supabase db push",
    "db:types": "supabase gen types typescript --local > src/types/database.types.ts"
  }
}
```

### 命名の妥当性

- `db:nuke` … `db:stop` と差別化しつつ「破壊的に消す」というニュアンスが伝わる
- 他候補(却下理由): `db:reset:hard`(`db:reset` の派生に見えるが実体は stop 系)/ `db:wipe`(`db:reset` と区別が付きにくい)/ `db:stop:fresh`(`stop` で fresh は意図不明)

### `db:nuke && db:start` を 1 コマンドにしない理由

- 「volume を捨てる」操作はローカル開発データを失う破壊的操作。1 コマンドでまとめると暴発しやすい。
- README に 2 ステップで明記する方が、利用者が「自分で何を捨てているか」を意識できる。
- 既存の `db:start` / `db:stop` の単純な mapping を崩さない(将来 CLI のオプションが変わったときの修正面積も最小)。

## README.md への追加

`## トラブルシュート` の最後(`colima` の節の後)に以下の節を追加する:

```markdown
### `npm run db:start` が `relation "user_profiles" already exists` で失敗する

エラー例:

\`\`\`
Applying migration 20260503000000_create_user_profiles.sql...
ERROR: relation "user_profiles" already exists (SQLSTATE 42P07)
\`\`\`

原因: `supabase stop`(デフォルト)は Docker volume(`supabase_db_lgtmhub`)を「バックアップ」として保持します。volume と Supabase CLI が管理する migration 履歴が不整合になると、次回 `supabase start` 時に `Initialising schema...` が走り、既存テーブルと衝突して上記エラーになります。

> **注意**: 以下の手順は **ローカルの開発データ(画像・ユーザー等を含む)を完全に破棄** します。

復旧手順:

\`\`\`bash
# 1. volume ごと破棄
npm run db:nuke

# 2. 新規に起動(マイグレーションが順次適用される)
npm run db:start
\`\`\`

`npm run db:nuke` は内部で `supabase stop --no-backup` を実行し、`supabase_db_lgtmhub` / `supabase_storage_lgtmhub` の Docker volume を削除します。
```

(README 内で表示する fence は実ファイルでは escape 不要)

## 動作確認シナリオ

ローカル devcontainer 上で次の流れを目視確認する:

1. **正常系の volume 持続が壊れていないこと**
   - `npm run db:nuke && npm run db:start` → `Initialising schema...` 経由でマイグレーションが全て適用される
   - `npm run db:stop && npm run db:start` → `Starting database from backup...` で復元される(マイグレーションは適用されない)
2. **README の手順で復旧できること**
   - 上記サイクルが回ること自体が、不整合が起きたときの「捨てて作り直す」フローを再現している

## リスクと回避

| リスク | 回避策 |
|---|---|
| 利用者が `db:nuke` をローカル DB バックアップ用途と勘違いし、必要なデータを捨てる | README の説明で「**ローカルの開発データを完全に破棄します**」と明示し、`db:stop`(バックアップ保持)と並べて差を示す |
| 将来 Supabase CLI が `stop --no-backup` のフラグ名を変更する | スクリプトを 1 行で薄くラップしているため、`package.json` 1 箇所の修正で追従可能 |

## ロールアウト

- 単一 PR / 単一 commit(1PR = 1 関心事原則)
- ブランチ: `fix/db-start-relation-already-exists`(main 起点。Issue #4 の `feat/separate-supabase-env` とは独立)
- マージ後の deploy 影響なし(ローカル開発体験のみ)
