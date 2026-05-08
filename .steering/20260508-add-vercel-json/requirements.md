# 要求仕様: vercel.json 新規作成（IaC化第一歩）

## 背景

GitHub Issue #65「Vercel/Supabase 設定の IaC 化方針調査」で結論付けた次の一歩のうち、最初のタスクに着手する。

> `vercel.json` を新規作成（`$schema` 付き、headers / 将来の crons 用枠を確保）

現状、Vercel プロジェクト設定は Dashboard 手動管理のみで、リポジトリ上にプロジェクト設定ファイル（`vercel.json`）が存在しない。
- `next.config.ts` には Next.js のビルド設定はあるが、Vercel 固有の rewrites / headers / crons / functions 設定はコード化されていない
- セキュリティヘッダ（`X-Content-Type-Options` など）も未設定。`docs/architecture.md` の「セキュリティアーキテクチャ」では転送時暗号化（HTTPS）のみ言及があり、レスポンスヘッダレベルの防御は記述されていない

## ゴール

- リポジトリ直下に `vercel.json` を新規作成し、IDE 補完を効かせる `$schema` を付与する
- Vercel のレスポンスヘッダ機能を使って **基本的なセキュリティヘッダ** をコード化する
- 将来的に画像論理削除のクリーンアップ等で `crons` を追加する想定を、設計ドキュメントとして明示しておく

## 非ゴール

- Content-Security-Policy（CSP）の本格設定は対象外
  - Next.js の Server Components / Server Actions 動的 nonce と `vercel.json` の静的ヘッダ機能は相性が悪く、別タスクで middleware 経由の CSP 注入方針を決めるべき
- Vercel CLI / Terraform Vercel Provider の導入は対象外（Issue #65 の別タスク）
- 環境変数の運用ルール整備は対象外（Issue #65 の別タスク）
- `crons` の実体追加（実コード）は対象外。今回は「将来の追加先がわかる状態」までで止める
- 既存の Next.js ビルド設定（`next.config.ts`）の移植は行わない

## 解決アプローチ

1. プロジェクト直下に `vercel.json` を新規作成する
2. `$schema` に Vercel 公式スキーマ URL（`https://openapi.vercel.sh/vercel.json`）を指定し、エディタ補完を有効化
3. `headers` セクションに全パス共通で適用するセキュリティヘッダを定義
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()`
   - `Strict-Transport-Security` は Vercel が自動付与するため二重指定しない
4. `crons` は今回は実体を追加しない。`design.md` に「将来追加予定の cron スロット」を記述しておく
5. `npm run build` を流して Next.js / Vercel のスキーマ検証で破壊が無いことを確認

## 受け入れ条件

1. リポジトリ直下に `vercel.json` が存在し、`$schema` プロパティが Vercel 公式 URL を指している
2. `headers` セクションに上記 4 種類のセキュリティヘッダが、全パス（`source: "/(.*)"`）に対して定義されている
3. `npm run build` が成功する（`vercel.json` のスキーマ違反でビルドが落ちない）
4. `npm run lint` / `npm run typecheck` / `npm test` がいずれもエラーなく完了する
5. `design.md` に「将来 crons をここに追加する」旨の記述があり、設定例（コメント形式の予約）が示されている
6. `docs/architecture.md` のセキュリティ章に、`vercel.json` 経由でレスポンスヘッダを管理している旨を追記している
