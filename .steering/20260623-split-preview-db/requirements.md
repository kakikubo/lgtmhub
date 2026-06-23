# requirements.md

## 関連 Issue

- 本タスク: [Issue #20](https://github.com/kakikubo/lgtmhub/issues/20) のうち「本番 DB / Preview DB の分離」部分
- 関連: `.github/workflows/supabase-deploy.yml`, `supabase/config.toml` の `[remotes.prod]`

## 背景

現状、Supabase プロジェクトは本番 1 つ (`qbkoalhilwtjydpscrye` / lgtm2, Tokyo ap-northeast-1) のみ。
Vercel の Production / Preview デプロイは**同一の本番 DB を共有**しており、Preview から本番データを
書き換えられてしまう。Issue #20 の「本番 DB と Preview DB を分離し、Preview から本番データを触れない
構成にする」を実現する。

アプリ (`src/lib/supabase/client.ts` / `server.ts`) は `NEXT_PUBLIC_SUPABASE_URL` /
`NEXT_PUBLIC_SUPABASE_ANON_KEY` をランタイム参照しているだけなので、**参照先 DB の切り替えは
Vercel 環境変数のスコープ分けで実現できる**(アプリコードの変更は不要)。

## 今回の要求

1. **Preview 専用 Supabase プロジェクトを新規作成**(独立した 2 つ目のプロジェクト、Tokyo, 無料枠)
2. **本番 DB → Preview DB へデータをフルコピー**(auth.users 含む / 一度きりのスナップショット)
3. **Preview と本番を別 DB として稼働**させ、Preview デプロイは Preview DB を参照する
4. migrations / config.toml の Preview への反映は **CI で自動化**(prod/preview 両対応に拡張)

## 決定事項(ユーザー確認済み)

| 論点 | 決定 |
|------|------|
| データコピー範囲 | **フルコピー(auth.users + public 全テーブル)**。FK 連鎖 (`auth.users → user_profiles → lgtm_images / daily_upload_counts`) のため意味あるコピーには auth が必須 |
| コピー頻度 | **一度きり**(Preview 立ち上げ時のスナップショット) |
| migrations/config 反映 | **CI 拡張**(`supabase-deploy.yml` を prod/preview matrix 化) |
| Branching | 採用しない(無料枠で独立プロジェクト 2 つ運用) |

## スコープ外 / 触らない

- アプリコード (`src/lib/supabase/*`) — 環境変数のみで切り替わる
- Vercel Blob / Supabase Storage / Edge Functions / Realtime(未使用)
- 定期リフレッシュの仕組み(今回は一度きり)

## 制約・注意

- 無料枠は 2 プロジェクトまで → 本番 + Preview でちょうど。3 つ目は不可
- `major_version 17` を Preview でも一致させる(config.toml と整合)
- Preview に本番の `SERVICE_ROLE_KEY` を絶対入れない(事故防止)
- データリストア時は `handle_new_user` トリガを無効化(auth.users insert での二重 insert 回避)
