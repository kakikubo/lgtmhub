# 要求仕様: Vercel Preview 環境でログイン後にプレビュー origin に留まる

## 背景

GitHub Issue #36 で、Vercel Preview 環境（例: `https://lgtmhub-git-fix-image-deletion-rls-kakikubos-projects.vercel.app/`）でログイン操作を行うと、認証フロー完了後に本番ドメインへリダイレクトされてしまい、Preview 環境のログイン状態を確認できないという課題が報告された。

- 期待挙動: Preview 環境でログイン → 同じ Preview origin に着地する
- 実態: 認証フロー後に本番ドメインに着地する
- アプリ側 `signInWithGithub()` (`src/lib/auth/actions.ts`) は `origin` ヘッダ → `x-forwarded-proto`/`host` の順で組み立てており、Preview の origin を正しく動的に算出する実装になっている
- 一方で、Supabase Auth は `redirectTo` が登録済みの「Site URL」または「Additional Redirect URLs」のいずれにもマッチしない場合、Site URL（本番）にフォールバックする

## ゴール

- Vercel Preview 環境でログインしたとき、PR ごとの動的 Preview URL でも同じ Preview origin に着地できるようにする
- 本番のログイン挙動を破壊しない
- 設定漏れを将来再発させないために、`.env.example` と `docs/development-guidelines.md` に必要な設定手順を追記する

## 非ゴール

- 認証フロー本体（`signInWithGithub` / `/api/auth/callback`）のロジック変更は対象外
  - 既に `origin` ヘッダベースで Preview 対応可能な実装になっており、コード変更ではなく設定とドキュメントで解決する
- Supabase Auth の Site URL を Preview に切り替える等、本番影響のある変更は行わない
- GitHub OAuth App 側の Authorization callback URL の見直しは対象外（Supabase 経由なので変更不要）

## 解決アプローチ

1. Supabase Dashboard の Auth > URL Configuration で、Additional Redirect URLs に Vercel Preview のワイルドカードを追加する
   - 例: `https://lgtmhub-git-*-kakikubos-projects.vercel.app/**`
   - 設定担当者（リポジトリオーナー）が手動で実施する
2. `.env.example` に上記設定が必要である旨をコメントで追記する
3. `docs/development-guidelines.md` に「Vercel Preview 環境での認証設定」セクションを追加し、以下を記述する:
   - 症状（本番にフォールバックされる）と原因（Supabase の Redirect URLs フォールバック仕様）
   - Supabase Dashboard で登録すべき URL パターン
   - GitHub OAuth App 側は Supabase 固定で OK である旨
   - アプリ側の `buildOrigin` の動作（Preview 環境でも `host` / `x-forwarded-proto` から自動解決される）

## 受け入れ条件

1. Supabase Dashboard に Vercel Preview ワイルドカードが登録された状態で、Preview 環境からログイン → 同じ Preview origin に着地する
2. 本番（main ブランチデプロイ）からのログインが従来通り動作する
3. PR ごとの動的 Preview URL（`lgtmhub-git-<branch>-kakikubos-projects.vercel.app`）でも 1. の挙動になる
4. `.env.example` に Supabase Auth の Site URL / Additional Redirect URLs の登録要件がコメントとして記載されている
5. `docs/development-guidelines.md` に Vercel Preview 環境での認証設定セクションが追加され、設定手順と挙動の根拠が記載されている
6. `npm run lint` / `npm run typecheck` / `npm test` がいずれもエラーなく完了する
