# 設計: Vercel Preview 環境でのログインリダイレクト修正

## 影響範囲

| 区分 | パス | 変更内容 |
|------|------|----------|
| 設定 (リポジトリ外) | Supabase Dashboard > Auth > URL Configuration | Additional Redirect URLs に Preview ワイルドカードを追加 |
| ドキュメント | `.env.example` | Supabase Auth 設定の前提条件をコメントで追記 |
| ドキュメント | `docs/development-guidelines.md` | 「Vercel Preview 環境での認証設定」セクションを追加 |

## 原因分析

### Supabase Auth のリダイレクト解決仕様

Supabase Auth の `signInWithOAuth` に渡した `redirectTo` は、以下の規則で最終リダイレクト先が決まる:

1. `redirectTo` が **Additional Redirect URLs** のいずれかのパターンに **完全一致** または **ワイルドカード一致** する → そこに戻す
2. `redirectTo` が **Site URL** と一致する → そこに戻す
3. 上記いずれにもマッチしない → **Site URL にフォールバック** する（= 本番ドメイン）

本リポジトリでは Site URL が本番ドメインに設定されており、Vercel Preview のドメイン（PR ごとに動的）が Additional Redirect URLs に未登録のため、3. に該当して本番に流される。

### アプリ側の origin 解決

`src/lib/auth/actions.ts` の `buildOrigin` は以下の優先順位で origin を組み立てる:

```ts
function buildOrigin(headerList: Headers): string {
  const origin = headerList.get('origin');
  if (origin) return origin;
  const proto = headerList.get('x-forwarded-proto') ?? 'http';
  const host = headerList.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}
```

- Server Action は POST のためブラウザが `Origin` ヘッダを付ける → Preview ドメインが入る
- 万一 `origin` が無くても、Vercel が付与する `x-forwarded-proto` と `host` で Preview ドメインが復元できる

つまりアプリ側のコードは既に Preview に対応している。**修正対象は Supabase ダッシュボードの設定とドキュメントのみ**。

## 実装方針

### Supabase Dashboard 設定（リポジトリ外）

Auth > URL Configuration に次を追加する:

- Additional Redirect URLs:
  - `https://lgtmhub-git-*-kakikubos-projects.vercel.app/**`
  - `https://lgtmhub-*-kakikubos-projects.vercel.app/**`（個別デプロイ URL 用、必要に応じて）

Site URL は本番ドメイン（既存値）を維持する。

> 注: Supabase の Redirect URLs はセグメント末尾用 `*` と複数セグメント用 `**` をサポートしている。Vercel Preview のサブドメイン部分は `*`、パスを含めて任意に許可するため末尾は `**` を使う。

### `.env.example` 追記

GitHub OAuth セクションに以下のコメントを追加する:

```env
# 注意: Vercel Preview 環境でログイン後に本番ドメインへ流される場合、
# Supabase Dashboard > Auth > URL Configuration の Additional Redirect URLs に
# Preview ドメインのワイルドカードを登録すること。
#   例) https://lgtmhub-git-*-kakikubos-projects.vercel.app/**
# 詳細: docs/development-guidelines.md の「Vercel Preview 環境での認証設定」を参照。
```

### `docs/development-guidelines.md` 追記

「Supabase利用規約」セクションの直後に新セクションを追加する。

セクション構成案:

```
### Vercel Preview 環境での認証設定

#### 症状
Preview 環境でログインボタンを押すと、本番ドメインに着地してしまう。

#### 原因
Supabase Auth は redirectTo が Site URL / Additional Redirect URLs のいずれにも
マッチしない場合、Site URL（= 本番ドメイン）にフォールバックする仕様。
PR ごとに変わる Vercel Preview のサブドメインは静的に列挙できないため、
ワイルドカードで登録する必要がある。

#### Supabase Dashboard 設定
Auth > URL Configuration の Additional Redirect URLs に以下を追加する:
  - https://lgtmhub-git-*-kakikubos-projects.vercel.app/**
  - 個別デプロイ URL 用が必要なら https://lgtmhub-*-kakikubos-projects.vercel.app/**

Site URL は本番ドメインのまま変更しない（変更すると本番フォールバックが Preview に流れる）。

#### GitHub OAuth App 側
Authorization callback URL は Supabase の固定 URL
(https://<project-ref>.supabase.co/auth/v1/callback) を維持する。
Preview ごとに変える必要はない。

#### アプリ側の origin 解決
src/lib/auth/actions.ts の buildOrigin が、Origin ヘッダ → x-forwarded-proto/host の
順に Preview の origin を動的算出する。コード側の追加対応は不要。
```

## 代替案と却下理由

| 候補 | 採否 | 理由 |
|------|------|------|
| Site URL を Preview ワイルドカードに変更 | × | Site URL は本番のフォールバック先として機能している。変更すると意図しない遷移が起きる |
| `redirectTo` を `NEXT_PUBLIC_SITE_URL` のような環境変数で本番固定 | × | Preview のたびに変数を切り替える運用が破綻する。現行の動的 origin 解決の方が堅牢 |
| Supabase Dashboard 設定の追加を放置し、Preview では認証を確認しない | × | Issue #36 の受入条件「Preview 環境でログイン → 同じ Preview origin に着地」を満たせない |
| `buildOrigin` に `VERCEL_BRANCH_URL` 環境変数フォールバックを追加 | × | Server Action の通常実行で `host` ヘッダから取れるため不要。逆に環境変数依存を増やすとローカル/CI で挙動差が生じる |

## リスク・留意点

- **Supabase Dashboard 設定変更はリポジトリ管理外**: 設定漏れの再発を防ぐため、`.env.example` と `docs/development-guidelines.md` の両方で参照可能にしておく
- **ワイルドカード許可の範囲**: `*-kakikubos-projects.vercel.app` のみを許可することで、第三者の Vercel プロジェクトに対する open redirect は塞がれる。Supabase 側で前方/後方一致もチェックしているため、サブドメイン奪取がない限り安全
- **アプリ側の `buildOrigin` の堅牢性**: Server Action は同一 origin POST のため `Origin` ヘッダが付く前提だが、将来 Server Action 以外（外部からのリダイレクト経由など）で呼ぶ場合は別途見直しが必要。今回は対象外
- **検証コスト**: Preview デプロイは PR 作成後でないと URL が確定しないため、設定とドキュメント変更の PR を出した後に手動で動作確認する流れになる
