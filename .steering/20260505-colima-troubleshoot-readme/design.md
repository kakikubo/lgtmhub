# 設計書

## 方針

README.md にドキュメントを追記するだけの変更。アプリコード・設定ファイルには触らない。

## 追加場所

`README.md` の「日常的な開発コマンド」節と「ライセンス」節の間（`---` 区切りの前）に、新たに `## トラブルシュート` セクションを追加する。

理由:
- セットアップ系の節 (`## 開発環境セットアップ`) と並列に置く
- 末尾の `## ライセンス` は触らない
- 将来 colima 以外のトラブルが出てきたら、同じ節に小見出しを増やせる構造にする

## 追記内容の構成

```markdown
## トラブルシュート

### colima で `npm run db:start` の `supabase_vector` 起動が失敗する

エラー例:

\`\`\`
failed to start docker container "supabase_vector_lgtmhub":
Error response from daemon: error while creating mount source path
'/Users/<user>/.config/colima/default/docker.sock': mkdir ...: operation not supported
\`\`\`

原因: `supabase_vector`（analytics ログ収集コンテナ）が Docker socket をマウントしようとした際、colima のソケット実体パスが Docker 側から見えないため失敗する。

回避手順（**ローカル限定。コミットしないこと**）:

1. `supabase/config.toml` の `[analytics]` ブロックを `enabled = false` に変更する
   \`\`\`toml
   [analytics]
   enabled = false
   \`\`\`
2. `npm run db:stop && npm run db:start` で再起動
3. `git checkout -- supabase/config.toml` などで、コミット前に必ず差分を戻す

> リポジトリのデフォルトは `enabled = true` のままにします（Docker Desktop / CI ではそのまま動作するため）。 colima 利用時のみ手元で一時的に無効化してください。
```

## 既存 README との整合

- 章立て: `## 開発環境セットアップ` → `### 前提` → `### 初回セットアップ` の流れと同じ深さ (`##` / `###`) を踏襲
- コードブロック: `bash` / `toml` / 単純な fenced block を既存の使い方に合わせる
- 注意書き: 既存の `> 本番（Vercel）へのデプロイ時は……` 形式の blockquote を踏襲

## ロールバック

README.md だけの変更なので、Edit を取り消せばロールバック完了。

## 検証

- 目視: README.md をプレビューし、章立て・コードブロックが崩れないこと
- `npm test` / `npm run lint` / `npm run typecheck` が pass すること（README は対象外なので影響なし、回帰確認のみ）
