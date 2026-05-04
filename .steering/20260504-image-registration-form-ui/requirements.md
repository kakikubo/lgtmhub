# 要求内容: 画像登録フォーム UI

## 背景

PRD `P0 #1 画像登録機能` の API (`POST /api/images`) は実装済みだが、UI が存在せず、現状は curl で直叩きしないと登録できない。
ヘッダーやトップページ (`/`) からの導線も「画像を登録する」リンクが行き止まり (該当ページなし) になっている。

本作業で「画像 URL を貼って送信 → 一覧に登録済みの LGTM 画像が増える」という MVP 主要ループを UI 上で完結させる。

## 対象 PRD

- `docs/product-requirements.md` 「P0 #1 画像登録機能」
- `docs/repository-structure.md` で予約済みの `app/(site)/images/new/page.tsx` と `components/image-register-form.tsx`

## ユーザーストーリー

ログイン済みユーザーとして、LGTM 画像のバリエーションを増やすために、Web 上の画像 URL をフォームから送信して LGTM 文字を合成した画像を登録したい。

## 受け入れ条件

### 入口・遷移

- [ ] グローバルヘッダーに「画像を登録する」リンクを表示する (ログイン済みユーザーのみ)。リンク先は `/images/new`
- [ ] `/images/new` を Server Component で実装する。未ログインアクセスはトップ (`/?auth_error=login_required`) にリダイレクトする
- [ ] 登録成功後はトップページ (`/`) にリダイレクトし、新規登録画像が一覧に表示される (Next.js キャッシュを再検証する)
- [ ] フォームには「キャンセル」リンク (戻り先 `/`) を併設する

### フォーム

- [ ] 入力項目は「画像 URL」(必須・テキスト) の 1 つ
- [ ] クライアント側で `createImageRequestSchema` (zod) を再利用して即時バリデーションし、無効な入力は送信前にメッセージ表示する
- [ ] 送信ボタンは送信中 disabled になり、ラベルが「登録中…」へ変わる
- [ ] 送信は `fetch('/api/images', { method: 'POST', body: { imageUrl } })` で行う
- [ ] レスポンスは zod で runtime バリデーションし、`as` キャストを使わずに型安全に扱う

### エラー表示

API のステータスコードを次のメッセージにマップして、フォーム下部に表示する。

| ステータス | 表示メッセージ | 補足 |
|------------|----------------|------|
| 400 | 「入力値が正しくありません」(API の error 文言を併記) | URL 形式・対応外フォーマット・サイズ超過 |
| 401 | 「セッションが切れました。再度ログインしてからお試しください」 | 再ログイン導線 (GitHub OAuth ボタン or トップへ) を併設 |
| 409 | 「同じ画像がすでに登録されています」 | 既存画像 ID は将来 `/images/[id]` 実装時にリンク化する。本 PR では非リンクで保持 |
| 429 | 「本日の登録上限 (10 枚) に達しました。明日再度お試しください」 | |
| 500 / その他 | 「画像の登録に失敗しました。時間をおいて再度お試しください」 | 詳細はサーバーログで追う |

ネットワーク失敗 (fetch reject) も 500 と同じメッセージを表示する。

### テスト

- [ ] 共通スキーマ (`createImageResponseSchema` / `createImageErrorResponseSchema`) のユニットテストを追加する
- [ ] エラーメッセージマッピング (純関数) のユニットテストを追加する
- [ ] E2E (Playwright) で「未ログイン → /images/new へアクセス → トップにリダイレクト」を確認する
- [ ] E2E でヘッダー「画像を登録する」リンクの可視性 (未ログイン時は非表示) を確認する

## 非対応 (スコープ外)

- 画像詳細ページ (`/images/[id]`) と重複時のリンク遷移 — 別 PR
- お気に入り・画像削除・通報 — 別 PR
- ファイルアップロード対応 (PRD #9, P1) — 別 PR
- 画像登録中のプレビュー表示 — フォームには出さず、登録完了後の一覧で確認する MVP 体験を維持
- 画像登録中の進捗バー / WebSocket — API 自体が同期完了する仕様のため不要
- Vercel Analytics の `image_registered` カスタムイベント — Analytics 整備と一緒に別 PR

## 制約

- 同期 API 仕様 (`functional-design.md` 「画像登録」) のまま、UI 側は単一 fetch で 201 / エラーを受ける
- 既存パターン (`signInWithGithub` Server Action / `createClient()` Server Component) を踏襲する
- 1 PR = 1 関心事 (`~/.claude/rules/pr-principle.md`) を守る。本作業は「登録 UI」に絞る

## 参考

- `docs/functional-design.md` 「API設計 > 画像登録」 (リクエスト・レスポンス仕様)
- `docs/repository-structure.md` 「P1 / 画像登録 UI 関連」 (配置先)
- `components/load-more-button.tsx` (Client Component の `fetch` + zod パース実装パターン)
- `app/(site)/page.tsx` (Server Component 経由の Supabase 認証チェック実装)
