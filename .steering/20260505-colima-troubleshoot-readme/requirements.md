# 要求内容

## 概要

colima 利用者が `npm run db:start` で `supabase_vector` コンテナの起動に失敗するため、回避手順を README に追記する。

## 背景

GitHub Issue #3 (関連 PR #2) のローカル動作確認時、colima 環境で以下のエラーが発生した。

```
failed to start docker container "supabase_vector_lgtmhub":
Error response from daemon: error while creating mount source path
'/Users/<user>/.config/colima/default/docker.sock': mkdir ...: operation not supported
```

原因は `supabase_vector`（analytics ログ収集コンテナ）が Docker socket をマウントしようとした際、colima のソケット実体パスが Docker 側から見えず失敗するため。

リポジトリのデフォルトは Docker Desktop でも colima でも揃えたいので、`supabase/config.toml` をコミットして変えるのは過剰。README にトラブルシュート節を作って、回避手順だけを案内する。

## 実装対象

### 1. README にトラブルシュート節を追加

- 「## トラブルシュート」セクション (もしくは同等の節) を新設し、colima 利用者向けの項を追記する
- 採用案 A: `supabase/config.toml` の `[analytics] enabled = false` をローカル限定で適用する手順
  - **コミットしないこと** を明示する注意書きを必ず添える
- 再現コマンドおよびエラーメッセージの抜粋を載せ、検索でヒットしやすくする

## 受け入れ条件

- [ ] README に「colima 利用者向けトラブルシュート」が追加されている
- [ ] 採用案 (A) を 1 つ選び、再現コマンドと合わせて記載されている
- [ ] `supabase/config.toml` を **コミットしない** よう明示されている
- [ ] 既存の README のトーン・構成（章立て、コードブロックの体裁）と整合している

## 成功指標

- colima 環境の新規開発者が README だけで `npm run db:start` を起動できる
- リポジトリのデフォルト設定 (`[analytics] enabled = true`) は変更しない

## スコープ外

- `supabase/config.toml` 自体の変更
- 案 B (`docker.sock` の symlink) / 案 C (`DOCKER_HOST`) の併記（環境依存が大きく、案 A で十分な再現性があるため不採用）
- Docker Desktop / Linux 利用者向けの追記
- `docs/development-guidelines.md` 等、他ドキュメントへの転載

## 参照

- Issue: https://github.com/kakikubo/lgtmhub/issues/3
- 関連 PR: https://github.com/kakikubo/lgtmhub/pull/2
- 対象ファイル: `README.md`, `supabase/config.toml`（参照のみ）
