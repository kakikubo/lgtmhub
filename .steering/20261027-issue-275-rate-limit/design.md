# API レートリミット (#275)

## 結論

固定ウィンドウを Supabase の `rate_limit_buckets` に置き、`service_role` だけが実行できる RPC で加算する。日次 10 枚の atomic increment は取得・合成の前に行い、失敗したら枠を戻す。

Vercel の複数インスタンスで共有できることと、環境変数を増やさずに本番で効くことを優先した。

## 設計

| 対象 | キー | 上限 |
|---|---|---|
| `GET /api/images/random` | IP | 60 秒に 30 |
| `POST /api/images` | IP / ユーザー | 60 秒に 20 / 5 |
| `POST /api/images/[id]/regenerate` | 管理者ユーザー | 60 秒に 5 |

超過は 429 と `Retry-After: 60`。ランダム取得の 429 は `Cache-Control: no-store`。

日次枠は `increment_daily_upload_count` を `buildLgtmVariant` の前に呼ぶ。取得・重複・合成・DB 登録の失敗時は `release_daily_upload_count` で 1 戻す。この RPC は `auth.uid()` が本人のときだけ減算する。

## 検討した代替案

| 案 | 却下理由 |
|---|---|
| `@upstash/ratelimit` + Vercel KV | 認証情報が無く、未設定のままでは本番で制限が効かない |
| Vercel WAF | リポジトリから 429 を unit テストできない |
| プロセス内カウンタ | Vercel のインスタンスをまたげない |

## Non-goals

- `GET /api/images` の一覧、お気に入り、認証コールバックの制限
- ウィンドウ残秒までの正確な `Retry-After`（窓の長さ 60 秒を返す）
