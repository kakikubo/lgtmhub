# 要求: Vercel 関数のリージョンを東京 (hnd1) に揃える

## 背景 / 関連 issue

- GitHub issue: [#150 Vercel 関数のリージョンを東京 (hnd1) に揃える (Issue #46 案 #4)](https://github.com/kakikubo/lgtmhub/issues/150)
- 親 issue: [#46 トップページの体感速度改善](https://github.com/kakikubo/lgtmhub/issues/46) の **改善案 #4**
- 計測根拠: [PR #149 (案 #3)](https://github.com/kakikubo/lgtmhub/pull/149) の preview 計測

PR #149 の preview 計測中、レスポンスヘッダ `x-vercel-id` が

```
x-vercel-id: hnd1::iad1::<reqid>
```

であることが判明した。

- **Vercel Edge: `hnd1` (Tokyo)** — リクエスト受け口は東京 ✅
- **Vercel Function: `iad1` (US East / Virginia)** — SSR / Route Handler の実行関数が US 東海岸 ⚠️

Vercel は新規プロジェクトの関数デフォルトリージョンを `iad1` とするため、明示指定しない限り全 Route Handler / SSR が US 東海岸で実行される。CDN ミス時・`unstable_cache` の revalidate 時・`POST`/`DELETE` の全てで Vercel 関数 → Supabase の問い合わせが US 東海岸を経由し、日本のユーザー向けサービスとして RTT が無駄に伸びている。

### 計測上の傍証 (PR #149)

`/api/images` の TTFB (CDN ミス / 関数実行時):

| 環境 | 1st (cold) | 2nd | 3rd |
|------|-----------|-----|-----|
| Production (関数 iad1) | 3.19 s | 1.06 s | 1.06 s |
| Preview (CDN HIT 時) | 0.45 s | 0.50 s | 0.32 s |

CDN HIT 時は Edge (hnd1) で完結するため速いが、関数を実行するパス (cold start / POST / DELETE / revalidate) は軒並み 1 秒超。

## 対応する docs

- [技術仕様書: デプロイ・実行環境 / パフォーマンス要件 (architecture.md)](../../docs/architecture.md)
  - `architecture.md:145` は既に「Vercel Function（リージョン: hnd1）」を前提としているが、実態は未指定 (= `iad1`)。本対応で実態をドキュメントに一致させる。
- 過去 steering: [20260508-add-vercel-json](../20260508-add-vercel-json/) (vercel.json 新規作成), [20260528-cache-control-api-images](../20260528-cache-control-api-images/) (案 #3 / 本 Issue の計測根拠)

## 今回の実装スコープ

`vercel.json` に関数リージョンを明示し、全 Vercel 関数を `hnd1` (Tokyo) で実行させる。

### 含むもの

1. **`vercel.json` にトップレベル `regions` を追加**
   - `"regions": ["hnd1"]`
   - Vercel 公式仕様 (docs 2026-05-12 更新) に基づく。トップレベル `regions` はプロジェクトの全 Vercel 関数のデフォルトリージョンを設定する。単一リージョン指定は全プラン (Hobby 含む) で利用可能。
2. **`docs/architecture.md` のデプロイ・実行環境セクションを更新**
   - 関数リージョンを `vercel.json` の `regions` で `hnd1` に固定している旨を明記。
   - `architecture.md:145` の前提 (hnd1) と実装の整合を確立。

### 含まないもの (スコープ外)

- **Supabase プロジェクトのリージョン移設** — ダッシュボード確認の運用タスク。期待値は `ap-northeast-1` (Tokyo)。ずれていた場合の移設は影響大のため別途検討 (本 PR ではコード変更なし)。
- **per-function (`functions.<glob>.regions`) 指定** — 全関数を Tokyo に寄せる方針のため、トップレベル `regions` で十分。Next.js App Router では `app/**` glob のパスマッチが不安定なため採用しない (design.md 参照)。
- **`preferredRegion` route segment config** — 関数単位の上書きが必要になった時の選択肢。今回は全関数一律のためトップレベル設定を優先。
- **デプロイ後の TTFB 計測 / `x-vercel-id` 確認** — デプロイ環境でのみ実施可能。tasklist.md のデプロイ後タスクに記載し、PR preview で証跡を取得する。

## 受け入れ条件

### 機能要件

- [ ] `vercel.json` トップレベルに `"regions": ["hnd1"]` が含まれる
- [ ] `vercel.json` が有効な JSON で `$schema` に準拠する
- [ ] 既存の `headers` 設定は変更されない (リグレッションなし)
- [ ] デプロイ後、`x-vercel-id` が `hnd1::hnd1::...` になる (関数も東京)

### 品質 / 検証

- [ ] `npm run lint` / `npm run typecheck` / `npm test` が全パス
- [ ] `vercel.json` が JSON として valid (パース可能)

## 完了条件 (issue #150)

- [ ] Vercel 関数が `hnd1` で実行される (preview デプロイの `x-vercel-id` で確認)
- [ ] Supabase プロジェクトリージョンが確認され、Tokyo で揃っている (または移設方針が決定している)
- [ ] 関数実行パス (`POST /api/images` など) の TTFB 短縮を計測

## 前提・制約

- 単一リージョン (`hnd1`) 指定は Hobby プランでも可能。複数リージョンは Pro (最大3) / Enterprise のみ。
- トップレベル `regions` は Serverless Functions に適用される。Edge Middleware は常にユーザー近傍の Edge で動くため対象外 (`x-vercel-id` の Edge 部は既に `hnd1`)。
- Supabase が `ap-northeast-1` 以外だった場合、関数を `hnd1` にしても DB 往復は遠回りになる。Supabase リージョン確認は完了条件の一部。
