# tasklist.md

## 実装タスク (テンプレート整備)

- [ ] `supabase/.env.example` を新規作成 (`GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` の 2 キーのみ、Vercel Preview 関連コメント含む)
- [ ] root `.env.example` から GitHub OAuth ブロック(L18-28 相当)を削除

## 実装タスク (README 修正)

- [ ] README L36 周辺(初回セットアップ Step 2)のコメントから「GitHub OAuth」を削除し、次節への案内を追記
- [ ] README L51-71「GitHub OAuth セットアップ」の Step 3 を `cp supabase/.env.example supabase/.env` 起点に書き換え
- [ ] README L65-67 の `set -a && source .env.local && set +a` 代替案を削除(B 改と相容れないため)

## 検証タスク (ローカル移行)

- [ ] 既存の `supabase/.env` を削除
- [ ] `cp supabase/.env.example supabase/.env` で再生成し、OAuth 値を記入
- [ ] 既存の `.env.local` から `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET` 行を削除

## 検証タスク (動作確認)

- [ ] `npm run db:stop && npm run db:start` を実行し、起動ログに `WARN: environment variable is unset: GITHUB_OAUTH_*` が出ないことを確認
- [ ] `npm run dev` でトップから「GitHub でログイン」を実行し、認証完了でリダイレクトされることを目視
- [ ] (sanity check) `npm run typecheck` / `npm test` / `npm run lint` が green であることを確認

## コミット / PR タスク

- [ ] 4 ファイル分の差分 (`supabase/.env.example` 新規、`.env.example` 修正、`README.md` 修正、`.steering/...` 追加) を 1 コミットにまとめる(関心事:「OAuth env の管轄を Supabase CLI 側に分離」)
- [ ] 日本語コミットメッセージ規約に従う (1 行目: 何をしたか / 空行 / 箇条書きで詳細)
- [ ] PR を作成し、Issue #4 を `Closes #4` でクローズ予約

## 申し送り

### 実装完了日

(実装完了時に記入)

### 計画と実績の差分

(実装完了時に記入)

### 学んだこと

(実装完了時に記入)

### 次回への改善提案

(実装完了時に記入)
