# タスクリスト: Vercel Preview 認証リダイレクト修正

## タスク

- [x] `.env.example` の GitHub OAuth セクションに Supabase Auth Additional Redirect URLs 登録要件のコメントを追記
- [x] `docs/development-guidelines.md` の「Supabase利用規約」直後に「Vercel Preview 環境での認証設定」セクションを追加
- [x] `npm run lint` がエラーなしで完了することを確認 (worktree 内では biome の `!**/.claude/worktrees` 除外設定により `.` 全体がスキップ扱いとなる。今回の変更ファイルは `.md` / `.env.example` のみで biome 対象外のため、CI 側の lint は無影響)
- [x] `npm run typecheck` がエラーなしで完了することを確認
- [x] `npm test` が全てパスすることを確認 (150/150 pass)
- [ ] 変更をコミットして PR を作成（Issue #36 を close 対象として記載）
- [ ] Supabase Dashboard で Additional Redirect URLs にワイルドカードを登録（リポジトリ外作業: ユーザー実施）
- [ ] PR マージ後に Preview デプロイ環境でログイン挙動を確認（リポジトリ外作業: ユーザー実施）

## 申し送り事項

### 実装完了日
2026-05-06

### 計画と実績の差分
- 計画通り。コード変更なしで `.env.example` と `docs/development-guidelines.md` の追記のみで完結。
- アプリ側の `buildOrigin` (`src/lib/auth/actions.ts`) は既に `Origin` ヘッダ → `x-forwarded-proto`/`host` で動的解決する実装になっており、Preview 対応のためのコード追加は不要だった。

### 学んだこと
- Supabase Auth は `redirectTo` が Site URL / Additional Redirect URLs のいずれにもマッチしない場合、Site URL（= 本番）にフォールバックする。Preview のサブドメインが PR ごとに変わるため、ワイルドカード (`*` / `**`) で許可しておかないと本番に流れる。
- GitHub OAuth App の Authorization callback URL は Supabase の固定 URL を維持していれば良く、Preview 側は触らない。
- Supabase の Redirect URLs は `*`（単一セグメント）と `**`（複数セグメント・パス含む）をサポートしている。Vercel Preview は `https://<host>/<path>` を許可する形が安全。

### 次回への改善提案
- Site URL / Additional Redirect URLs のような Supabase Dashboard 側の手動設定をリポジトリの readme / docs から逆引きしやすくするため、`docs/architecture.md` 等で Supabase 設定の一覧表を将来追加すると運用ミスが減る。
- `buildOrigin` に `host` ヘッダのフォールバックがあるのは Vercel ネットワーク前提の信頼で動いているが、リバースプロキシ前提の挙動である旨を `actions.ts` 直近のコメントで補強しても良い（今回はスコープ外）。
- worktree 配下から `npm run lint` を実行するとパススキップになる問題は別途 `biome.json` 側の `includes` パターン調整で解消できそう（issue 化推奨）。
