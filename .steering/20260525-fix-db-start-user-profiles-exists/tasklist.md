# tasklist.md

## 実装タスク

- [x] `package.json` の `scripts` に `db:nuke` を追加(`supabase stop --no-backup`)
- [x] `README.md` のトラブルシュート章に「`relation "user_profiles" already exists` で失敗する」節を追加(原因 / 注意 / 復旧手順 2 ステップ)

## 検証タスク (ローカル動作確認)

- [x] `npm run db:nuke` 実行後に `docker volume ls --filter label=com.supabase.cli.project=lgtmhub` で volume が空になることを確認
- [x] `npm run db:start` で `Initialising schema...` → 全 migration が適用されることを確認
- [x] `npm run db:stop && npm run db:start` で `Starting database from backup...` で復元されることを確認(既存サイクルが壊れていないこと)

## 検証タスク (静的チェック)

- [x] `npm run typecheck` を実行し pass することを確認
- [x] `npm run lint` を実行し pass することを確認(`biome lint .` exit 0、ローカル rtk hook の解釈で `npm run lint` の exit code は誤って 1 と表示されるが本質は pass)
- [x] `npm test` を実行し pass することを確認(194 / 194 passed)

## コミット / PR タスク

- [x] 3 ファイル分の差分(`package.json` / `README.md` / `docs/development-guidelines.md`)+ ステアリングを 1 コミットにまとめる
- [x] 日本語コミットメッセージ規約に従う(1 行目: 何をしたか / 空行 / 箇条書きで詳細)
- [x] PR を作成し、本文に Issue 番号(Closes #143)を含める

## 申し送り

### 実装完了日

2026-05-25

### 計画と実績の差分

- 計画外で `docs/development-guidelines.md` の npm scripts 一覧にも `db:nuke` を追記(implementation-validator の指摘によりスペック整合性を担保)。
- README の `db:nuke` 説明文末尾に `db:stop`(volume 保持)との対比を 1 文追加(同レビューでの誤用防止指摘)。
- それ以外は design.md 通りに実装完了。

### 学んだこと

- `supabase stop` のデフォルト挙動は Docker volume をバックアップとして保持する(ログ末尾に `Local data are backed up to docker volume.` が出る)。
- `supabase start` は volume が無い場合は `Initialising schema...` から migrations を順次適用、存在する場合は `Starting database from backup...` で復元する。
- volume と CLI 側 migration 履歴が不整合だと、復元と migration の両方が走り 42P07 を踏む。
- CI(`.github/workflows/ci.yml`)が `supabase stop --no-backup` で運用されているのは、CI ジョブごとに volume を確実にクリアして再現性を確保するためだったと裏付けられた。

### 次回への改善提案

- ローカル開発で「`db:start` がコケた → 自動で nuke して retry」のような自動回復はあえて入れない方が安全。volume には開発中のデータが乗っているため、暴発時の被害が大きい。
- Supabase CLI の upstream issue が見つかった場合は README のトラブルシュート節からリンクを張ると、利用者が状況を把握しやすい。
