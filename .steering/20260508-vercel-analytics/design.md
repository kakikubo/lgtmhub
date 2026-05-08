# 設計: Vercel Analytics / Speed Insights のルートレイアウト組み込み

## 全体方針

- `app/layout.tsx`（Root Layout）の `<body>` 末尾に `<Analytics />` と `<SpeedInsights />` を配置する一点投入の導入とする
- どちらも内部で `'use client'` 扱いだが、Server Component から子要素として描画する分には境界を意識する必要はない（Next.js 公式サンプル通り）
- `(site)` セグメントの `layout.tsx` には何も足さない。アプリ全体の計測なのでルートで一度だけマウントすれば全ページに伝搬する

## 採用パッケージ

| パッケージ | 用途 | サブパス | 備考 |
|----------|------|---------|------|
| `@vercel/analytics` | PV / 訪問者 / リファラ計測 | `@vercel/analytics/next` | App Router 用エントリ |
| `@vercel/speed-insights` | Web Vitals (LCP / CLS / INP) | `@vercel/speed-insights/next` | App Router 用エントリ |

バージョンは `npm install` 時の最新安定版（caret range）を採用し、`renovate.json` の既存 `packageRules` に乗せて以後の追従は Renovate に任せる。専用グループは作らない（更新頻度が低く、`@vercel/blob` も独立運用しているのと整合）。

## 実装箇所

### `app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LGTMHub',
  description: '安心安全な LGTM 画像共有サービス',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
```

- `<Analytics />` / `<SpeedInsights />` は `{children}` の **後** に配置する（Vercel 公式推奨。アプリ本体のレンダリングを優先するため）
- どちらのコンポーネントも `process.env.VERCEL_ENV` を見て本番／プレビュー／開発を自動判定する。開発環境では計測ビーコンが飛ばないため、ローカル動作確認では「import エラーが出ない」「DOM にスクリプトタグが挿入されない」程度を確認すれば十分

## ドキュメント更新

### `docs/architecture.md`

- 「モニタリング・可観測性」セクションの **TODO** から Vercel Analytics / Speed Insights の項目を「実装済み」に格上げ
  - 計測対象: PV / 訪問者 / リファラ / Web Vitals (LCP / CLS / INP)
  - エントリポイント: `app/layout.tsx` で `<Analytics />` / `<SpeedInsights />` をマウント
  - データの確認先: Vercel ダッシュボードの該当プロジェクト（リンクは記載しない、URL 変動リスク）
- 「パフォーマンス要件」セクションは既に Vercel Analytics を計測手段として明記しているため、内容の追加は不要

`docs/development-guidelines.md` への追記は不要。コーディング規約・Git 運用・テスト戦略のいずれにも該当しないため。

## テスト戦略

| レイヤー | 戦略 |
|--------|------|
| ユニットテスト | 追加なし。`<Analytics />` / `<SpeedInsights />` はサードパーティのスクリプトローダーであり、自前でロジックを書かないため |
| 統合テスト | 追加なし |
| E2E | 追加なし。Vercel Analytics は `VERCEL_ENV=production` でしか動作しないため、ローカル / CI のヘッドレス実行では計測自体が発生しない |
| 静的検証 | `npm run typecheck` でモジュールパス（`@vercel/analytics/next` 等）が解決できることを担保。`npm run build` で本番ビルドが通ることを確認 |
| 手動検証 | 本番デプロイ後、Vercel ダッシュボードでイベントが取得できることを目視確認（受け入れ条件） |

## リスクと緩和策

- **計測がダブる**: 既存の `<Analytics />` 利用箇所が無いことを Grep 済み。新規導入のため衝突しない
- **クライアントサイドで実行されるか**: `@vercel/analytics/next` は内部で `'use client'` を持つコンポーネントを export しているため、Server Component の Root Layout に配置しても Next.js が自動でクライアントバウンダリを切る
- **本番以外で動作してしまう**: `VERCEL_ENV` 判定はパッケージ側に任せる。明示的な環境分岐コードは書かない（公式が判定済みのものを二重実装しない方針）
- **CSP / セキュリティヘッダ**: `vercel.json` の `headers` で CSP は未設定（Strict-Transport-Security のみ自動付与）。Vercel Analytics のスクリプトは Vercel 自身が配信し、Vercel ホスティング下では追加許可不要

## ロールバック手順

1. `git revert` でコミットを戻す
2. `npm install` で `package-lock.json` を再生成（依存削除を反映）
3. ルートレイアウトから両コンポーネントが消えることでスクリプト読み込みが停止し、計測が止まる

ダッシュボード側のデータは Vercel が保持するため、コード側のロールバックでデータが消えることはない。
