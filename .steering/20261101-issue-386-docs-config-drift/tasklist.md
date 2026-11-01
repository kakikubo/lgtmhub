# タスクリスト: docs の設定転記乖離解消 (Issue #386)

## フェーズ1: docs 修正

- [x] architecture.md の技術スタック表を実態に合わせる（zod / @vercel/blob / Node.js / pnpm の表記ずれも併せて修正）
- [x] architecture.md「バージョン管理方針」の package.json 全文コピーを要点 + リンクに置換
- [x] development-guidelines.md 前提環境表を実態に合わせる
- [x] development-guidelines.md の ci.yml 全文コピーをジョブ構成表 + リンクに置換
- [x] development-guidelines.md Codecov セクションの action バージョンと計測範囲を修正
- [x] development-guidelines.md の package.json scripts 全文コピーを要点 + リンクに置換
- [x] glossary.md の Sharp バージョンを修正
- [x] CLAUDE.md の TypeScript バージョンを修正
- [x] danger.yml コメントの dangerfile.ts を dangerfile.js に修正

## フェーズ2: 検証

- [x] 古い転記値が docs に残っていないことを grep で確認
- [x] lint:md / check / typecheck / test を実行

## 実装後の振り返り

### 実装完了日

2026-11-01

### 計画と実績の差分

- Issue に記載の箇所に加えて、技術スタック表の古い表記も直した（zod 3.x、@vercel/blob 0.27.x、@supabase/ssr 0.5.x、pnpm 10.x、Node.js v24.11.0）
- implementation-validator の指摘を受け、Node.js 行の「engines で固定」と「24.12.0 以上」の混同を解消した。engines は 24.x、24.12.0 以上は Corepack で pnpm 12 を使うための要件（README 参照）と書き分けた
- `codecov.yml` の ignore コメントが vitest の exclude（components/ui 等）と完全には一致していないが、Issue の範囲外のため触っていない

### 学んだこと

- 設定ファイルの全文コピーは Renovate の更新に追従できず、必ずずれる。docs には設計意図だけを残し、値はリンク先を正とするのがよい
- 削除した YAML の設計意図は ci.yml のコメントにすべて残っていたため、docs 側はジョブ構成表で十分だった

### 次回への改善提案

- docs にバージョンを書くときはメジャー表記（`7.x`）までにする。パッチやマイナーの値は書かない
