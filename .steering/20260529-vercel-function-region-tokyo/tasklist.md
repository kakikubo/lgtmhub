# タスクリスト: Vercel 関数リージョンの東京 (hnd1) 固定 (Issue #150 / #46 案 #4)

## 実装タスク

### コード変更

- [x] T1. `vercel.json` の `$schema` 直後に `"regions": ["hnd1"]` を追加 (既存 `headers` は不変)

### ドキュメント

- [x] T2. `docs/architecture.md`「デプロイ・実行環境」に関数リージョンを `vercel.json` の `regions` で `hnd1` 固定する旨を追記

### 検証

- [x] V1. `vercel.json` が valid JSON であることを確認 (parse)
- [x] V2. `npm run lint` がパス (exit 0、biome schema 2.4.14/2.4.15 の info は既存・無関係)
- [x] V3. `npm run typecheck` がパス
- [x] V4. `npm test` がパス (18 files / 196 tests)

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

2026-05-29 (コード/ドキュメント変更完了。デプロイ後の実測 D1/D2 と Supabase 確認 R1 は preview / 運用で実施)

### 計画と実績の差分

- 当初 issue 本文は `"functions": { "app/**": { "regions": ["hnd1"] } }` を例示していたが、Vercel 公式 docs (2026-05-12) を確認した結果、**トップレベル `regions` 指定**の方が Next.js App Router では安定かつ標準的と判断し方針変更。per-function glob は Next.js のビルド出力パスにマッチさせる必要があり不安定。
- 実装はコード変更ゼロ。`vercel.json` 1 行追加 + `architecture.md` 追記のみで完結。
- `architecture.md:152` のパフォーマンス表は変更前から「リージョン: hnd1」を前提にしており、実態 (`iad1`) と乖離していた。本対応で実態をドキュメントに一致させた (ドキュメント先行の歪みを是正)。

### 学んだこと

- Vercel の関数デフォルトリージョンは新規プロジェクトで `iad1` (US 東海岸) 固定。明示しない限り日本向けでも US で実行される。
- 単一リージョン指定は Hobby プランでも可能。複数リージョンのみ Pro (最大3) / Enterprise 制約。
- `regions` は Serverless Functions のみ対象で Edge Middleware には効かない。`x-vercel-id` の `<edge>::<function>::<reqid>` で Function 部のリージョンを判定できる。
- 関数を東京にしても Supabase が `ap-northeast-1` 以外だと RTT 改善は限定的。R1 (Supabase リージョン確認) が改善効果の前提条件。

### 次回への改善提案

- D1/D2 (preview の `x-vercel-id` 確認 + TTFB 計測) は PR #149 と同じ Protection Bypass トークン手法で preview 前倒し計測する。
- R1 (Supabase リージョン確認) はダッシュボード作業。`us-east-1` 等だった場合の移設は影響大のため、別 Issue で移設方針を検討する。
- ドキュメントが実態より先行 (aspirational) すると今回のような乖離が生まれる。インフラ設定の「正本」は `vercel.json`、docs はその参照とする運用を徹底する。
