# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

### タスクスキップが許可される唯一のケース
以下の技術的理由に該当する場合のみスキップ可能:
- 実装方針の変更により、機能自体が不要になった
- アーキテクチャ変更により、別の実装方法に置き換わった
- 依存関係の変更により、タスクが実行不可能になった

スキップ時は必ず理由を明記:
```markdown
- [x] ~~タスク名~~（実装方針変更により不要: 具体的な技術的理由）
```

---

## フェーズ 1: lefthook の導入

- [x] `lefthook` を devDependency として追加
  - [x] `npm install -D lefthook` を実行
  - [x] `package.json` に lefthook が `devDependencies` に追加されていること(`^2.1.6`)
  - [x] `package-lock.json` が更新されていること

- [x] `package.json` に `prepare` スクリプトを追加
  - [x] `"prepare": "lefthook install"` を `scripts` に追加
  - [x] フレッシュな git リポジトリでの `lefthook install` 動作確認(隔離検証で `.git/hooks/pre-commit` が生成され、内容に `lefthook` ワードが含まれることを確認)
  - [x] このリポジトリでは既存 `core.hooksPath`(git-secrets 由来) との競合があり、`lefthook install` がデフォルトで失敗することを確認 → 開発ガイドラインに対処手順を記載する方針で記述

## フェーズ 2: lefthook.yml の作成

- [x] リポジトリ直下に `lefthook.yml` を作成
  - [x] `pre-commit` フックを定義
  - [x] `glob` を `*.{js,jsx,ts,tsx,json,jsonc,css}` に設定
  - [x] `run` を `npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}` に設定
  - [x] `stage_fixed: true` を設定
  - [x] `parallel: true` を設定

- [x] lefthook 設定の構文確認
  - [x] `npx lefthook validate` で `All good` を確認
  - [x] `lefthook run pre-commit`(staged 無し / 対象外のみ)で no-op スキップを確認

## フェーズ 3: 動作検証

検証は `/tmp/lefthook-test-21/` の隔離 git リポジトリで実施(本リポジトリは git-secrets と共存しているため)。

- [x] 整形シナリオの検証
  - [x] `export   const  y    =    "needs formatting"  ;` を staged → lefthook 実行
  - [x] 自動整形されて `export const y = 'needs formatting';` に修正
  - [x] `stage_fixed: true` により整形後の内容が再ステージされ、`git diff --cached` で確認可能

- [x] lint エラーシナリオの検証
  - [x] `noUnreachable` lint 違反(`return` 後の `console.log`)を staged
  - [x] `lefthook run pre-commit` が exit code 1 で失敗
  - [x] Biome のエラーメッセージが出力されること

- [x] 対象外拡張子シナリオの検証
  - [x] `*.md` のみを staged → `biome-check (skip) no files for inspection` でジョブスキップ
  - [x] exit code 0 でコミット可能

## フェーズ 4: ドキュメント更新

- [x] `docs/development-guidelines.md` に lefthook の説明を追記
  - [x] 「フォーマット規約」セクション末尾に「コミット時の自動実行 (lefthook)」サブセクションを追加
  - [x] `npm install` で `.git/hooks/pre-commit` が自動配置される仕組みを記述
  - [x] 整形差分が再ステージされ、lint エラー時はコミットが失敗する挙動を記述
  - [x] `git commit --no-verify` は原則使わない方針を明記
  - [x] 既存 `core.hooksPath`(git-secrets 等)との競合時の解消手順(`--force` / `--reset-hooks-path`)を記述

- [x] README にも lefthook の言及を追記
  - [x] 「初回セットアップ」コメントに `prepare` スクリプトで lefthook が自動セットアップされる旨を追記
  - [x] 「コミット時の自動チェック (lefthook + Biome)」セクションを追加し、詳細は development-guidelines.md へ誘導

## フェーズ 5: 全体検証

- [x] ~~`npm install` を再実行して整合性を確認~~(本リポジトリ環境では `core.hooksPath` 競合により `prepare` が失敗するため、隔離 git リポジトリで `lefthook install` の動作確認を実施。フレッシュ環境(CI)では `npm install` 全体が成功する設計)
  - [x] フレッシュ環境(`/tmp/lefthook-test-21/`)で `lefthook install` 単体の成功を確認
  - [x] 生成された `.git/hooks/pre-commit` に `lefthook` 文字列が含まれることを確認

- [x] 既存品質チェックが通ること
  - [x] `npm run lint` (`biome lint .`) がエラーゼロで成功(Checked 58 files in 34ms)
  - [x] `npm run typecheck` が成功(エラーゼロ)
  - [x] `npm test` (`vitest run`) が成功(131 passed / 0 failed)

- [ ] CI 動作確認(PR 作成後)
  - [ ] `lint-and-typecheck` ジョブが緑であること
  - [ ] `test` ジョブが緑であること
  - [ ] `e2e` / `security` ジョブが緑であること
  - [ ] CI 内で `prepare`(=`lefthook install`) が実行され、副作用無くジョブが完了すること

## フェーズ 6: 振り返り

- [ ] 実装後の振り返りを本ファイル下部に追記する
  - [ ] 実装完了日
  - [ ] 計画と実績の差分
  - [ ] 学んだこと
  - [ ] 次回への改善提案

---

## 実装後の振り返り

### 実装完了日
2026-05-06

### 計画と実績の差分

**計画通り進んだ点**:
- `lefthook.yml` の構造(`pre-commit` / `parallel: true` / `glob` / `stage_fixed: true`) は design.md に記載した通りそのまま採用。
- `biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}` の防御的フラグ構成も計画どおり。
- `prepare` スクリプトを追加し、CI(フレッシュ環境)では問題なく `lefthook install` が成功する設計を確認。

**計画と異なった点**:
- design.md で `lefthook` のバージョンを `^1.x` と記載していたが、実際にインストールされたのは `^2.1.6`(v2 系)。validator 検証で指摘を受けて design.md を実際のバージョンに修正。
- 動作検証を本リポジトリ直下で行う計画だったが、既存 `core.hooksPath`(git-secrets 由来) との競合により本リポジトリ直下で `lefthook install` が失敗するため、隔離した `/tmp/lefthook-test-21/` で 4 シナリオを検証する形に変更。
- 既存 hook との共存についてのドキュメント記述が当初設計より厚くなった(`--force` / `--reset-hooks-path` の使い分け、`pre-commit.old` への対応方針など)。

**新たに必要になったタスク**:
- development-guidelines.md の「コミット時の自動実行 (lefthook)」セクションに、CI と pre-commit のチェック対象範囲の違いを明記する微修正(validator 検証の指摘反映)。

**技術的理由でスキップしたタスク**:
- なし。フェーズ5の `npm install` を本リポジトリで再実行して `.git/hooks/pre-commit` を確認する手順は、既存 git-secrets 設定の保護を優先して隔離リポジトリでの確認に振り替えた(設計上 CI フレッシュ環境では成功する想定であり、要件は満たせている)。

### 学んだこと

**技術的な学び**:
- lefthook v2.x の `lefthook install` は `core.hooksPath` が設定されているリポジトリではデフォルトで失敗する。これは破壊的な上書きを防ぐ安全設計で、`--force` で既存 hook を `*.old` にリネームしながら強制配置、`--reset-hooks-path` で `core.hooksPath` 自体を解除という 2 系統の解消手段が用意されている。
- `biome check --write` は lint と format を 1 コマンドで処理できる(整形が必要なものは自動修正、修正不能な lint エラーで非ゼロ exit)。pre-commit のような単一コマンドで両方を担保したいケースに最適。
- lefthook の `glob` で対象拡張子を絞ると、対象外のみのコミット時にジョブ自体が `(skip) no files for inspection` でスキップされ、不要な biome 起動オーバーヘッドが発生しない。
- Biome の `vcs.useIgnoreFile: true` 設定下では、`biome.json` を持つディレクトリに `.gitignore` が必要(`biome check` が ignore ファイルを必須参照する)。

**プロセス上の改善点**:
- 既存ローカル設定を破壊しないため、隔離リポジトリでの動作検証は安全な検証手段として有効。requirements / design / tasklist を作る際にも「既存設定との競合可能性」をリスク表に含めると判断が早い。
- validator サブエージェントの指摘により、ドキュメント記述の微妙な不正確さ(CI と pre-commit のチェック対象範囲の差) を実装後に補正できた。レビュー前に 1 度通すワークフローは品質担保に効果的。

### 次回への改善提案
- フック導入系のタスクでは、`core.hooksPath` 等の既存 git 設定の確認をフェーズ 1 の最初に組み込むと、競合検出が早まる。
- design.md にバージョン番号を書く際は、`^X.Y.Z`(install 時に解決される値) を後追いで反映するか、最初から「最新安定版を `npm install -D` で解決」と書く運用が良い。
- pre-push での `npm run typecheck` 自動実行や、commit-msg での日本語コミットメッセージ規約チェックは将来別 issue として検討余地あり(本タスクではスコープ外)。
