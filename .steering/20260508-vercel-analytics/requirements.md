# 要求内容: Vercel Analytics / Speed Insights を導入する

参照: [Issue #70](https://github.com/kakikubo/lgtmhub/issues/70)

## 背景

- LGTMHub のユーザー行動（人気ページ、流入経路、リファラなど）を可視化したい
- LCP / CLS / INP などの Core Web Vitals を本番で計測し、UX 改善の意思決定材料にする
- Next.js + Vercel ホスティング環境で公式の `@vercel/analytics` / `@vercel/speed-insights` を利用すれば最小コストで導入できる
- `docs/architecture.md` の「モニタリング・可観測性」「パフォーマンス要件」セクションでも Vercel Analytics を計測指標の正本として位置づけており、実装の裏付けが必要な状態

## ゴール

`<Analytics />` / `<SpeedInsights />` をルートレイアウトに組み込み、本番デプロイ後にダッシュボードで PV / Web Vitals が継続的に計測される状態にする。

## 受け入れ条件

- [ ] `@vercel/analytics` と `@vercel/speed-insights` が `dependencies` に追加されている
- [ ] `app/layout.tsx`（ルートレイアウト）で `<Analytics />` / `<SpeedInsights />` が `<body>` 配下にレンダリングされている
- [ ] `npm run build` / `npm run typecheck` / `npm run lint` / `npm test` がすべてパスする
- [ ] 本番デプロイ後、Vercel ダッシュボード（Analytics / Speed Insights）でデータが計測される（手動確認）
- [ ] `docs/architecture.md` の計測方針（Web Vitals 出所・KPI 計測の正本）が実装と整合している

## やりたいこと

- `@vercel/analytics` と `@vercel/speed-insights` の最新安定版を `npm install` で追加する
- `app/layout.tsx` の `<body>` 末尾に両コンポーネントをマウントする（Server Component に配置できる Client Component なので追加の境界調整は不要）
- Vercel プロジェクト側のダッシュボード有効化はリポジトリ管理者が GitHub/Vercel UI で実施する（本タスクのコードスコープ外、手順をドキュメント化）
- `docs/architecture.md` のモニタリング TODO を更新し、Vercel Analytics / Speed Insights の有効化を「実装済み」として明記する

## 制約・前提

- Next.js 15 App Router 環境であり、`@vercel/analytics/next` / `@vercel/speed-insights/next` のサブパスインポートを使う
- ホスティングが Vercel であるため、追加のスクリプトタグや CSP 設定の変更は不要（Vercel 側が自動でドメイン許可済み）
- プライバシー: Vercel Analytics は cookieless で個人特定をしないため、現行のプライバシーポリシー（未整備）への即時追記は必須ではない（追記要否は別 Issue で扱う）
- コスト: Hobby プラン無料枠で運用可能。閾値到達時は別途 Issue を起票して対応する

## 非対象

- カスタムイベント（`track()` 関数）の埋め込み — 必要になった時点で別タスクで設計
- プライバシーポリシーの起草・公開（別 Issue）
- Vercel ダッシュボード側の Analytics / Speed Insights 有効化操作（リポジトリ管理者の手作業、コードスコープ外）
- `dataLayer` / GTM / GA4 など他の計測基盤の導入
