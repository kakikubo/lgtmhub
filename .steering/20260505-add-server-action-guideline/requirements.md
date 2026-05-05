# 要求内容: Server Action サンプルをガイドラインに追記

## 関連 Issue / PR
- Issue #9
- PR #2 (`feature/github-oauth-auth` で `signInWithGithub` / `signOut` を実装)
- 申し送り元: `.steering/20260503-github-oauth-auth/tasklist.md` 申し送り事項 4

## 背景
`docs/development-guidelines.md` の「Next.js App Router 規約」には Route Handler のサンプル(`POST /api/images`)はあるが、Server Action（`'use server'`）のサンプルが未記載。
PR #2 の OAuth 実装で確立したパターン（`'use server'` 宣言、`headers()` からの origin 取得、`redirect()` の throw 挙動、open redirect ガード）を後続実装が迷わず参照できるよう、ガイドラインに反映する。

## 受け入れ条件
- [ ] `docs/development-guidelines.md` に Server Action 節が追加されている
- [ ] サンプルコードに以下のすべてが含まれている:
  - `'use server'` の宣言位置（ファイル先頭）
  - `headers()` からの origin 取り出しヘルパー（プロキシ / `x-forwarded-proto` 対応）
  - `redirect()` の利用例とその throw 挙動の注意書き
  - Open redirect ガード（相対パス制限）の例
- [ ] 既存の Route Handler 節と整合する書式・粒度で書かれている
- [ ] form の `action={...}` に渡す利用例（呼び出し側）が併記されている
- [ ] `npm run lint` / `npm run typecheck` / `npm run test` がエラーなく通る（ドキュメントのみ変更だが念のため確認）

## スコープ外
- 既存の Route Handler サンプルの書き換え
- Server Action のテスト戦略の本格的な記述（`redirect` を `vi.mock` で throw させるテクニックは PR #2 申し送り 4-1 で別途扱う想定）
- CSRF / `experimental.serverActions.allowedOrigins` の本番設定（申し送り 5 として別途）

## 制約
- 1PR = 1 関心事原則: 本作業は「ドキュメント追記のみ」で完結させる。実装コードへの変更は行わない
- サンプルは `src/lib/auth/actions.ts` / `app/api/auth/callback/route.ts` の実コードを抽象化したもの。秘匿情報・実エンドポイント名はそのまま転記して問題ないが、コメントは要点のみ残す
