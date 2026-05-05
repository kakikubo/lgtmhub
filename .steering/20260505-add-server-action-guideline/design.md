# 設計: Server Action サンプルの追記

## 変更対象
- `docs/development-guidelines.md` のみ

## 配置
「Next.js App Router 規約」セクションの「Route Handler のパターン」**直後**に「Server Action のパターン」サブセクションを追加する。
Route Handler と Server Action は対になる選択肢なので隣接させる。

## サブセクション構成

### Server Action のパターン

1. **使い分けの目安（短文）**
   - フォーム送信から DB 更新 + redirect で完結するもの → Server Action
   - 外部からの POST / 細かなステータスコード制御が必要 → Route Handler

2. **基本サンプル（OAuth サインイン / サインアウト の抽象）**
   - `'use server'` をファイル先頭で宣言
   - `headers()` から origin を取得する `buildOrigin` ヘルパー（`x-forwarded-proto` / `host` フォールバック）
   - `redirect()` で外部 URL or 相対パスへ遷移
   - エラー時はクエリ付き `redirect('/?auth_error=signin_failed')`

3. **呼び出し側（Client / Server Component）の書き方**
   - `<form action={signInWithGithub}>` 形式

4. **注意ボックス（重要な落とし穴）**
   - `redirect()` は内部で例外を throw する。`try/catch` で握り潰さないこと（テストでは `rejects.toThrow` で検証）
   - ユーザー入力由来の遷移先は **絶対に直接** `redirect(value)` しない。`safeNext` のような相対パスガードを通す
   - `'use server'` は **ファイル単位 or 関数単位** どちらかで必ず宣言。これがないと普通のサーバ関数になる

5. **Open redirect ガードのサンプル**
   - `app/api/auth/callback/route.ts` の `safeNext` を抜粋
   - Server Action から `redirect(value)` する場合も同様にガードする旨を一文で補足

## 書式方針
- 既存の Route Handler サンプルと同じインデント / トーンに揃える
- コードフェンスは ` ```typescript `
- インラインコメントは「WHY」のみ（CLAUDE.md コメント規約に従う）
- 表やリストは既存の節と粒度を揃え、過剰装飾はしない

## 影響範囲
- 永続ドキュメントの追記のみ。コード変更なし。
- 後続の実装者（画像登録 Server Action 等）が参照する想定の入口になる。

## 検証
- `npm run lint` / `npm run typecheck` / `npm run test` （ドキュメントのみだが規約上実行）
- 目視: `docs/development-guidelines.md` を頭から流し読みし、Route Handler 節 → Server Action 節 → エラーハンドリング節の流れに違和感がないこと
