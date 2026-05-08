# 設計: vercel.json 新規作成

## 影響範囲

| 区分 | パス | 変更内容 |
|------|------|----------|
| 設定 | `vercel.json`（新規） | プロジェクト直下に作成。`$schema` / `headers` を記述 |
| ドキュメント | `docs/architecture.md` | 「セキュリティアーキテクチャ > データ保護」にレスポンスヘッダ管理の記述を追加 |

実装コード（`src/`, `app/`, `components/`）には影響しない。

## ファイル構造

```jsonc
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
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

> 実ファイルは標準 JSON のためコメントは記載しない。本 design.md がドキュメントの正本。

## ヘッダ採用根拠

| ヘッダ | 値 | 採用理由 |
|--------|-----|----------|
| `X-Content-Type-Options` | `nosniff` | MIME スニッフィング無効化。Vercel Blob から配信する画像の Content-Type を信頼させる |
| `X-Frame-Options` | `DENY` | クリックジャッキング対策。本サービスは外部サイトへの埋め込みを想定しないため最厳設定 |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Next.js のデフォルトと整合。クロスオリジン遷移時のパス漏洩を防ぐ |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | 不要なブラウザ機能を全拒否。画像登録系のサービスのため、これらの権限要求は今後も発生しない |

> CSP 導入時の補足: `Content-Security-Policy: frame-ancestors 'none'` は `X-Frame-Options: DENY` と等価で、CSP 対応ブラウザでは CSP 側が優先される。両方併記しても問題ないが、CSP を後段で追加する際にどちらを正本とするかを再設計すること。

### 二重指定しないヘッダ

- `Strict-Transport-Security`: Vercel が独自ドメイン / `*.vercel.app` に対して自動付与する。`vercel.json` で明示すると Vercel 側のデフォルト（`max-age=63072000; includeSubDomains; preload`）と衝突する可能性があり、二重指定すると後勝ちで意図しない短い max-age が適用されるリスクがある
- `Content-Security-Policy`: 静的ヘッダで CSP を書くと `script-src 'self'` だけでは Next.js が生成するインライン script (chunks) が動かなくなる。動的 nonce が必要なため、middleware ベースで別タスクに分離する

## crons の扱い（将来の枠）

今回は cron ジョブを追加しないため `crons` キーは記述しない。空配列を入れると Vercel ダッシュボードで Cron Jobs タブが空状態で表示されて紛らわしいため、必要時にキー自体を追加する方針とする。

将来追加するときの想定:

```jsonc
// docs/architecture.md「論理削除と CDN キャッシュ」TODO で言及されている、
// 削除済み画像の Blob 物理削除ジョブを追加する場合
{
  "crons": [
    {
      "path": "/api/cron/cleanup-deleted-images",
      "schedule": "0 3 * * *"
    }
  ]
}
```

- `path` は `app/api/cron/...` 配下の Route Handler を指す。Vercel の cron は GET のみで、`Authorization: Bearer ${CRON_SECRET}` を Vercel が付与する
- `schedule` は cron 式（UTC 基準）

## なぜ Next.js の `headers()` ではなく `vercel.json` を使うか

Next.js の `next.config.ts` でも `headers()` 関数で同等のレスポンスヘッダを設定できるが、本 PR では `vercel.json` を採用する。

| 観点 | `vercel.json` | `next.config.ts` の `headers()` |
|------|---------------|--------------------------------|
| Issue #65 のスコープ | ✅ 一致（IaC化の第一歩） | ✗ Vercel 設定のコード化という文脈とは別物 |
| 適用層 | Vercel Edge Network（Next.js より外側） | Next.js Middleware より内側 |
| crons / rewrites / redirects との一元管理 | ✅ 同じファイルで完結 | ✗ それらは Next.js 側と Vercel 側で分かれる |
| 静的アセット (`public/`) への適用 | ✅ そのまま適用される | ✅ 適用される |

将来 Vercel 固有機能（`crons`, `firewall` 等）を増やす際の親和性も考えると、Vercel 設定を 1 ファイルに集約する方向が運用しやすい。

## docs/architecture.md への追記

「セキュリティアーキテクチャ > データ保護」配下の既存記述に、レスポンスヘッダの一行を追記する。

追加文（差分の体裁）:

```diff
 ### データ保護

 - **転送時暗号化**: 全通信HTTPS（VercelおよびSupabaseが自動でTLS終端）
 - **保存時暗号化**: Supabase / Vercel Blob ともにストレージレベルで暗号化（AES-256）
+- **レスポンスヘッダ**: `vercel.json` の `headers` で `X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy` を全パスに適用。`Strict-Transport-Security` は Vercel が自動付与するため二重指定しない。CSP は middleware ベースで別途検討（未着手）
 - **アクセス制御**:
```

## 代替案と却下理由

| 候補 | 採否 | 理由 |
|------|------|------|
| `next.config.ts` の `headers()` でセキュリティヘッダ設定 | ✗ | Issue #65 のスコープ（Vercel 設定の IaC 化）から外れる。crons / rewrites との集約性も劣る |
| `vercel.json` に CSP も今回入れる | ✗ | Next.js のインライン script や Server Actions の動作に nonce が必要で、静的ヘッダでは破壊的。middleware ベースで別タスク化 |
| `crons` を空配列で記述（プレースホルダ） | ✗ | Vercel ダッシュボードに「空の Cron Jobs」が表示されて誤解を招く。必要時にキーごと追加する方が明示的 |
| `headers` の `source` を `/((?!api).*)` に絞る（API レスポンスから除外） | ✗ | `X-Frame-Options` 等は API レスポンスにあっても害はなく、JSON 応答が iframe 直接表示される事故も塞げる。全パス適用が単純 |

## リスク・留意点

- **Vercel 自動ヘッダとの衝突**: HSTS / `X-Powered-By` 等は Vercel デフォルトに任せ、本 PR で重複指定しない
- **Vercel.json と Next.js のヘッダ優先順**: 両方で同じヘッダキーを設定すると **Vercel 側が後勝ちで上書き** する。今回は Next.js 側に同種ヘッダ設定が無いことを確認済み
- **CSP 未対応**: 既存比でセキュリティが「悪化」するわけではないが、CSP 未設定であることを `architecture.md` に明記し、後続タスク化していることを示す
- **画像配信パス**: Vercel Blob の画像は別ドメイン（`*.public.blob.vercel-storage.com`）から配信されるため、本 `vercel.json` のヘッダは適用されない。Blob 側の Cache-Control は SDK 経由で個別設定済み（`docs/architecture.md`「キャッシュ戦略」参照）
