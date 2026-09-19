# 設計書

## アーキテクチャ概要

Cloud Agent の環境は Cursor の優先順位に従い、リポジトリの `.cursor/environment.json` が最優先になる。install で依存を冪等に整え、start でネスト Docker と Supabase Local を毎起動時に復旧する。

```
checkout
  → install (.cursor/install.sh)
      Node 24 PATH / corepack / pnpm install --ignore-scripts / rebuild
  → start (.cursor/start.sh)
      dockerd → FORWARD ACCEPT → supabase start → .env.local
  → agent work (pnpm run check / test / e2e / dev)
```

## コンポーネント設計

### 1. `.cursor/environment.json`

**責務**:
- Cloud Agent の install / start エントリポイントを宣言する

**実装の要点**:
- `$schema` はスキーマが undeclared fields を拒否するため付けない
- コマンドはリポジトリ相対で `bash .cursor/install.sh` / `bash .cursor/start.sh`

### 2. `.cursor/install.sh`

**責務**:
- Node 24 を PATH 先頭に置き、pnpm 依存を導入する

**実装の要点**:
- `prepare`(lefthook install) が Cursor 管理の `core.hooksPath` と競合するため `--ignore-scripts`
- ネイティブモジュール（sharp 等）は `pnpm rebuild` で復元
- 冪等（2 回実行しても成功）

### 3. `.cursor/start.sh`

**責務**:
- Docker デーモンと Supabase Local を起動し `.env.local` を生成する

**実装の要点**:
- storage-driver は `fuse-overlayfs`
- legacy / nft 両方の `FORWARD ACCEPT` と bridge-nf 無効化でコンテナ間通信を確保
- `supabase status -o json` をリトライしてから `.env.local` を書く
- 秘密情報は書かない（OAuth は未設定でも起動継続）

## データフロー

### エージェント起動
```
1. Cursor が revision を checkout
2. install.sh が依存を導入
3. start.sh が Docker + Supabase を起動し .env.local を生成
4. エージェントが AGENTS.md の検証コマンドを実行
```

## エラーハンドリング戦略

- start は Docker / sysctl / iptables の失敗を可能なら握りつぶし、最終的に status 取得で成否を判断
- `supabase start` 失敗時も status リトライで既存スタックを拾う（冪等）

## テスト戦略

### 手動 / シェル検証
- `bash .cursor/install.sh` を 2 回実行して冪等を確認
- `bash .cursor/start.sh` 後に `supabase status` と `.env.local` の存在を確認
- `pnpm run check` / `typecheck` / `test` でアプリ健全性を確認

## 依存ライブラリ

新規ランタイム依存なし。

## ディレクトリ構造

```
.cursor/
  environment.json
  install.sh
  start.sh
AGENTS.md                 # Cloud 手順を拡充
README.md                 # Cloud Agent 節を追加
docs/repository-structure.md
.steering/20260919-cursor-cloud-agent-env/
```

## 実装の順序

1. install / start スクリプトと environment.json
2. ドキュメント更新
3. スクリプト検証と PR

## セキュリティ考慮事項

- `.env.local` に本番シークレットを埋め込まない
- `E2E_TEST_MODE` は e2e 実行時のみ明示的に付与（start では書かない）

## パフォーマンス考慮事項

- install は frozen-lockfile で決定的に
- start は既存 Docker / Supabase を再利用して再起動コストを抑える

## 将来の拡張性

- 必要なら `.cursor/Dockerfile` でベースイメージを固定
- Playwright ブラウザの install への組み込みは別 issue で検討可
