# 設計書

## アーキテクチャ概要

ジョブ単位の `timeout-minutes` でハングを打ち切り、e2e のブラウザ取得だけを `actions/cache` で短くする。アプリコードは変更しない。

```
GitHub Actions ジョブ
├─ timeout-minutes（全ジョブ）
│    lint/test/security/other = 10
│    e2e                      = 20
└─ e2e のみ
     actions/cache@v6  → ~/.cache/ms-playwright
     miss: playwright install --with-deps chromium
     hit:  playwright install-deps chromium
```

## コンポーネント設計

### 1. timeout-minutes

**責務**:
- ハングしたジョブをデフォルト 6 時間より早く失敗させる

**実装の要点**:
- `runs-on` を持つジョブと、`uses:` で再利用ワークフローを呼ぶジョブの両方に書く
- 呼び出し側に付けると再利用ワークフロー全体の上限になり、本体ジョブにも付けると本体単体の上限になる。両方書いて漏れを防ぐ
- 実測（成功 run `35416386797`）: lint 24 秒 / test 71 秒 / security 22 秒 / e2e 3.5 分。Issue の 10 / 20 分は 2〜3 倍以上の余裕

| ファイル | ジョブ | timeout-minutes |
|---|---|---|
| `ci.yml` | lint-and-typecheck / test / security | 10 |
| `ci.yml` | e2e | 20 |
| `danger.yml` | danger | 10 |
| `release-drafter.yml` | update_release_draft | 10 |
| `supabase-deploy.yml` | prod / preview | 10 |
| `supabase-preview-migrate.yml` | push | 10 |
| `_supabase-push.yml` | push | 10 |

### 2. Playwright ブラウザキャッシュ

**責務**:
- Chromium 本体の再ダウンロードを省略する

**実装の要点**:
- `actions/cache@v6`（公開時点の latest major。他 action と同様に major のみ指定し Renovate に任せる）
- `path`: `~/.cache/ms-playwright`
- `key`: `playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}`
- `restore-keys` は使わない。古いブラウザを部分リストアするとバージョン不一致になる
- OS パッケージ（`--with-deps`）は apt 側でキャッシュできない。ヒット時は `install-deps chromium` のみ
- 既存の `pnpm exec playwright install --with-deps chromium` を上記の分岐に置き換える。常時 `--with-deps` を残すとキャッシュの効果はダウンロード省略だけになる

### 3. ドキュメント

**責務**:
- CI の timeout 方針と Playwright キャッシュをガイドラインに残す

**実装の要点**:
- 正典は `docs/development-guidelines.md` の「CI/CDパイプライン > GitHub Actions」
- サンプル YAML に `timeout-minutes` と cache ステップを足す。action のバージョンは従来どおり「ci.yml を正」とする注記のまま触らない
- 短い説明（なぜ timeout するか、ヒット時に install-deps だけか）をサンプルの前後に置く
- `docs/architecture.md` は CI 詳細を guidelines に委譲しているため変更しない

## データフロー

### キャッシュミス（初回 / lockfile 変更）
```
1. actions/cache が miss
2. playwright install --with-deps chromium（ブラウザ + OS パッケージ）
3. build / test:e2e
4. ジョブ成功後に ~/.cache/ms-playwright を保存
```

### キャッシュヒット
```
1. actions/cache が ~/.cache/ms-playwright を復元
2. playwright install-deps chromium（OS パッケージのみ）
3. build / test:e2e
```

### ジョブハング
```
1. ジョブが timeout-minutes を超える
2. GitHub Actions がジョブを打ち切って失敗させる
3. デフォルト 6 時間まで Runner を占有しない
```

## エラーハンドリング戦略

アプリの実行時エラー処理は無い。CI 上の失敗は次のとおり:

- timeout: ジョブが `timeout-minutes` 超過で失敗。設定が短すぎる場合は実測を見て延長する
- キャッシュ破損: ヒットなのにブラウザが無いと e2e が落ちる。キーに lockfile ハッシュを含め、`restore-keys` を使わないことで予防する。修復は次ランの miss（キー変更）か cache 削除

## テスト戦略

### ユニットテスト
- YAML / ドキュメントのみなので新規テストは不要

### ゲートの確認
- `.github/workflows/` を grep し、`jobs:` 配下の全ジョブに `timeout-minutes` があること
- `ci.yml` の e2e に cache ステップと miss/hit 分岐があること
- アプリコードを変えないため `pnpm run check` / `typecheck` / `test` は回帰確認として実行する

## 依存ライブラリ

追加の npm パッケージなし。GitHub Action は `actions/cache@v6` を e2e ジョブで使う。

## ディレクトリ構造

```
.github/workflows/ci.yml
.github/workflows/danger.yml
.github/workflows/release-drafter.yml
.github/workflows/supabase-deploy.yml
.github/workflows/supabase-preview-migrate.yml
.github/workflows/_supabase-push.yml
docs/development-guidelines.md
.steering/20260919-issue-278-ci-timeout-playwright-cache/
```

## 実装の順序

1. 全ワークフローのジョブに `timeout-minutes` を付ける
2. e2e に Playwright cache と miss/hit 分岐を入れる
3. `docs/development-guidelines.md` を更新する
4. grep とローカル品質コマンドで確認する

## セキュリティ考慮事項

- キャッシュ対象は Playwright が落としたブラウザバイナリのみ。secret や `.env` は含めない
- fork PR でも `actions/cache` は読み取り可能な範囲で動く。書き込み権限の追加は不要

## パフォーマンス考慮事項

- 初回（miss）は現状と同等か、cache 保存の数秒増
- 2 回目以降は Chromium ダウンロード（数百 MB）を省略する。apt の `install-deps` は残る
- lint/test の timeout 10 分は実測の十倍以上ある。冷キャッシュや npm registry 遅延を吸収するための余裕であり、短くしすぎない

## 将来の拡張性

- Docker / Supabase イメージのキャッシュは e2e がまだボトルネックなら別 Issue で扱う
- Playwright を firefox/webkit に広げる場合は同じ cache path で足りる。キーにブラウザ名を足す必要は、ブラウザ集合が変わったときに無効化したい場合のみ
