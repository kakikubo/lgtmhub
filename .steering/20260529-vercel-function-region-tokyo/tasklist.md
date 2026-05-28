# タスクリスト: Vercel 関数リージョンの東京 (hnd1) 固定 (Issue #150 / #46 案 #4)

## 実装タスク

### コード変更

- [ ] T1. `vercel.json` の `$schema` 直後に `"regions": ["hnd1"]` を追加 (既存 `headers` は不変)

### ドキュメント

- [ ] T2. `docs/architecture.md`「デプロイ・実行環境」に関数リージョンを `vercel.json` の `regions` で `hnd1` 固定する旨を追記

### 検証

- [ ] V1. `vercel.json` が valid JSON であることを確認 (parse)
- [ ] V2. `npm run lint` がパス
- [ ] V3. `npm run typecheck` がパス
- [ ] V4. `npm test` がパス

### PR

- [ ] P1. 関心事ごとにコミット分割:
  - コミット 1: ステアリングファイル追加
  - コミット 2: 実装 (vercel.json) + ドキュメント (architecture.md)
- [ ] P2. PR タイトル: `Vercel 関数のリージョンを東京 (hnd1) に固定 (#46 案 #4)`
- [ ] P3. PR 本文: `Closes #150` / `Relates to #46`、設計概要 / 計測予定を記載

## デプロイ後タスク (PR preview で実施 / マージ後の追加確認)

### 検証 (デプロイ環境)

- [ ] D1. PR preview URL で `/api/images` にアクセスし `x-vercel-id` が `hnd1::hnd1::...` (Function も東京) になることを確認
- [ ] D2. 関数実行パス (`POST /api/images` / CDN MISS の GET) の TTFB が短縮したことを計測 (PR #149 の Production 値 1.06s 〜 3.19s と比較)

### 環境確認 (運用 / ユーザ作業)

- [ ] R1. Supabase ダッシュボードでプロジェクトリージョンを確認 (期待: `ap-northeast-1` / Tokyo)
  - ずれていれば移設要否を判断 (移設は影響大のため別途検討)

### Issue クローズ

- [ ] C1. Issue #150 に preview 計測結果 + Supabase リージョン確認結果をコメント
- [ ] C2. Issue #150 をクローズ (完了条件を満たしたら)

## 申し送り (振り返り)

### 実装完了日

(実装後に追記)

### 計画と実績の差分

(実装後に追記)

### 学んだこと

(実装後に追記)

### 次回への改善提案

(実装後に追記)
