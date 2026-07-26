# 設計: Vercel 関数リージョンの東京 (hnd1) 固定

## 影響範囲

| 区分 | パス | 変更内容 |
|------|------|----------|
| 設定 | `vercel.json` | トップレベルに `"regions": ["hnd1"]` を追加 |
| ドキュメント | `docs/architecture.md` | 「デプロイ・実行環境」に関数リージョン固定の記述を追加 |

実装コード (`src/`, `app/`, `components/`) には影響しない。純粋なデプロイ設定変更。

## ファイル構造 (変更後 vercel.json)

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["hnd1"],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()" }
      ]
    }
  ]
}
```

> 実ファイルは標準 JSON のためコメントは記載しない。`headers` は既存のまま維持し、`regions` を `$schema` の直後に挿入する。

## 設計判断: 3 つの指定方法の比較

Next.js (App Router) on Vercel で関数リージョンを指定する方法は 3 つある。Vercel 公式 docs (`/docs/functions/configuring-functions/region`, 2026-05-12 更新) を根拠に比較した。

| 方法 | 記法 | 適用範囲 | 採否 |
|------|------|----------|------|
| **トップレベル `regions`** | `"regions": ["hnd1"]` | プロジェクトの**全** Vercel 関数 | ✅ **採用** |
| per-function `functions` | `"functions": { "app/**": { "regions": ["hnd1"] } }` | glob にマッチした関数のみ | ❌ |
| route segment config | `export const preferredRegion = 'hnd1'` | export した route のみ | ❌ |

### トップレベル `regions` を採用する理由

1. **全関数を一律で東京に寄せる**のが目的 (SSR / 全 Route Handler / revalidate)。トップレベル指定は追加の glob 管理なしに全関数をカバーする。
2. **単一リージョン指定は全プランで利用可能** (Hobby 含む)。複数リージョンのみ Pro/Enterprise 制約があるが、今回は `hnd1` 単一なので制約に当たらない。
3. **公式 docs のプロジェクト設定例がトップレベル `regions`** (`{ "regions": ["sfo1"] }`)。最も標準的で安定した記法。

### per-function (`functions.app/**`) を採用しない理由

- issue 本文の例 (`"functions": { "app/**": { "regions": ["hnd1"] } }`) は Next.js App Router では **glob のパスマッチが不安定**。`functions` プロパティの glob は Vercel がビルドした関数の出力パスに対してマッチするため、ソースの `app/**` がそのまま当たる保証がない (公式例は `api/eu-data.js` のような単一ファイル指定)。
- そもそも「一部の関数だけ別リージョン」という要件がない。per-function はデータソースが地域分散している場合の機能であり、本プロジェクトには不要。

### route segment config (`preferredRegion`) を採用しない理由

- 全 route handler / layout に `export const preferredRegion = 'hnd1'` を散りばめる必要があり、追加漏れが起きやすい。
- リージョン方針はインフラ設定であり、アプリコードに散在させるより `vercel.json` に一元化する方が保守性が高い。

## Edge Middleware の扱い

`middleware.ts` は Edge Runtime で動作し、常にユーザー近傍の Edge で実行される。`regions` 設定は Serverless Functions に適用され、Edge Middleware には影響しない。`x-vercel-id` の Edge 部 (`hnd1`) は既に東京であり、本対応の対象外。本対応は `x-vercel-id` の **Function 部** (`iad1` → `hnd1`) を是正する。

## Supabase リージョンとの関係

関数を `hnd1` にしても、Supabase が `ap-northeast-1` (Tokyo) でなければ DB 往復は遠回りになる。Supabase リージョン確認は完了条件の一部だが、ダッシュボード操作 (ユーザ作業) でありコード変更を伴わないため、tasklist.md のデプロイ後 / 運用タスクとして扱う。コードベースから Supabase リージョンは判別不可 (URL は `<ref>.supabase.co` でリージョン非エンコード)。

## テスト戦略

- `vercel.json` は静的デプロイ設定であり、ユニットテストの対象外。
- 検証は (1) JSON parse の妥当性、(2) `npm run lint`/`typecheck`/`test` のリグレッション非発生、(3) preview デプロイでの `x-vercel-id` 実測、で行う。
- (3) はデプロイ環境でのみ可能なため、PR preview で証跡を取得する (PR #149 と同じ Protection Bypass トークン手法を流用)。

## ドキュメント更新方針 (architecture.md)

「デプロイ・実行環境」セクション (L89-104) に、関数リージョンを `vercel.json` の `regions` で `hnd1` に固定している旨を追記する。`architecture.md:145` のパフォーマンス表は既に「リージョン: hnd1」を前提にしているため、デプロイ設定の正本がどこか (vercel.json) を明示し、前提と実装の整合を確立する。
