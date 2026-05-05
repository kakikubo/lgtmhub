# 設計書

## アーキテクチャ概要

ローカルのコミット時に Biome の lint/format を自動実行するため、lefthook を Git フック管理ツールとして導入する。`npm install` 時に `prepare` スクリプトが起動して `lefthook install` が実行され、`.git/hooks/` 配下にラッパーが配置される。

```
git commit
   └─ .git/hooks/pre-commit (lefthook が生成)
        └─ lefthook run pre-commit
             └─ biome check --write --no-errors-on-unmatched <staged files>
                  ├─ 整形差分 → 再ステージ → そのままコミット成立
                  └─ lint エラー → 終了コード !=0 → コミット失敗
```

## コンポーネント設計

### 1. `lefthook.yml`(新規)

**責務**: pre-commit フックで Biome check を staged files に対して実行する。

**実装方針**:

```yaml
# 公式リポジトリ: https://github.com/evilmartian/lefthook
pre-commit:
  parallel: true
  jobs:
    - name: biome-check
      glob: "*.{js,jsx,ts,tsx,json,jsonc,css}"
      run: npx biome check --write --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
      stage_fixed: true
```

ポイント:
- `glob`: Biome がサポートする拡張子に限定。`html` も Biome v2 でサポートされるが、本リポジトリでは対象ファイルが存在しないため当面 JS/TS/JSON/CSS 系に限定する。
- `--write`: 自動修正可能な lint/format 違反は修正する。修正不能な lint エラーが残れば exit code 非 0 で失敗。
- `--no-errors-on-unmatched`: glob で絞られた後 staged が 0 件のときに失敗しない保険(lefthook 側でも空ならスキップされるが、stage_fixed との組合せで安全のため付与)。
- `--files-ignore-unknown=true`: glob 通過後でも Biome 側で未対応拡張子をスキップ(将来 `*.css.map` 等の混入時の保険)。
- `stage_fixed: true`: lefthook が修正後のファイルを `git add` して再ステージ。
- `parallel: true`: 将来 job が増えた場合に並列実行できるよう既定で有効化(現状は 1 job なので影響なし)。

**`biome check` を採用する理由**:
- `lint` 単体ではフォーマット違反が検出されない。
- `format --write` 単体では lint 違反でコミットを止められない。
- `check --write` は両方を同時に処理するため、1 コマンドで要件 (整形 + lint エラーで失敗) を満たせる。

### 2. `package.json`(更新)

**責務**: lefthook の devDependency 追加と prepare スクリプトの追加。

**実装方針**:

```diff
 "scripts": {
   "dev": "next dev",
   "build": "next build",
   "start": "next start",
+  "prepare": "lefthook install",
   "lint": "biome lint .",
   ...
 }
```

```diff
 "devDependencies": {
   "@biomejs/biome": "^2.4.14",
+  "lefthook": "^2.1.6",
   ...
 }
```

**`prepare` スクリプトに関する注意**:
- `prepare` は `npm install`(production install を除く) 直後に自動実行される npm のライフサイクルスクリプト。
- CI(`npm ci`)でも実行される。CI 上では Git フックが不要だが、`lefthook install` は `.git/` が存在すれば成功し、存在しなければ警告のみで終わる(GitHub Actions の checkout 後は `.git/` がある)。失敗してもビルドが落ちない仕様であれば許容するが、CI で副作用を最小化したい場合は環境変数 `CI` で分岐する選択肢もある。
- 今回は GitHub Actions の checkout 後 `.git/` が存在するため、CI でも `lefthook install` が実行される。`.git/hooks/` の書き換えは ephemeral なランナー上で完結し、CI ジョブの挙動には影響しない。

**lefthook のバージョン指定**:
- `npm install -D lefthook` で解決される最新安定版(現時点で `^2.1.6`)を採用し、`package-lock.json` で固定する。メジャーバージョンが上がる場合は依存更新タスクで別途検討する。

### 3. `docs/development-guidelines.md`(更新)

**責務**: lefthook の導入手順と動作概要を開発ガイドラインに追記する。

**追記方針**:
- 「フォーマット規約」セクションの末尾、または「開発環境セットアップ > 初回セットアップ」セクションに以下を追記:
  - `npm install` 直後に lefthook 経由で `.git/hooks/pre-commit` が自動配置されること
  - `git commit` で Biome の lint/format が自動実行されること
  - 整形差分は再ステージされコミットに含まれること
  - lint エラー時はコミットが失敗すること
  - 緊急時の `git commit --no-verify` バイパスは原則使わないこと

### 4. `README.md`(任意更新)

**責務**: 開発環境セットアップに lefthook の存在を 1 行追記し、詳細は `docs/development-guidelines.md` を参照させる。

## データフロー

### コミット時のフロー

```
1. ユーザー: git add で TS ファイルをステージ
2. ユーザー: git commit -m "..."
3. .git/hooks/pre-commit (lefthook 生成) が起動
4. lefthook が staged files から *.{ts,tsx,...} だけを抽出
5. biome check --write --no-errors-on-unmatched で実行
   ├─ 自動整形 → 修正後のファイルを保存
   └─ lint エラー → exit !=0
6a. 成功時: stage_fixed: true により lefthook が修正ファイルを git add
6b. 失敗時: lefthook が exit code を伝播 → git commit が中断
7. コミット完了 / 失敗
```

### `npm install` 時のフロー

```
1. npm install 実行
2. 全依存解決後、prepare スクリプトが起動
3. lefthook install が .git/hooks/ にラッパーを配置
4. .git/hooks/pre-commit に lefthook 起動コードが書き込まれる
```

## エラーハンドリング戦略

| 状況 | 挙動 |
|---|---|
| lefthook 未インストール状態でコミット | 通常通り `git commit` が成功(`.git/hooks/pre-commit` がそもそも無い) |
| `prepare` スクリプトの `lefthook install` 失敗 | `npm install` 全体が失敗。CI でも同様 |
| pre-commit 中の Biome lint エラー | `git commit` が中断(exit code 非 0)。修正後に再コミットする |
| pre-commit 中の format 自動修正 | `stage_fixed: true` により修正版がステージされ、コミットがそのまま成立 |
| 緊急時のバイパス | `git commit --no-verify` で hook をスキップ可能。ガイドラインで使用を抑制する旨を明記 |

## テスト戦略

設定変更タスクのため自動テストは追加しない。代わりに以下の動作確認を実施:

### 動作確認シナリオ

1. **インストール検証**:
   - `npm install` 後 `.git/hooks/pre-commit` が存在すること
   - 中身に `lefthook` の文字列が含まれること(`grep lefthook .git/hooks/pre-commit`)

2. **整形シナリオ**:
   - 整形が必要な変更(例: スペース過剰)を作成
   - `git add` → `git commit` で自動整形され、整形版がコミットされること
   - `git show HEAD` の差分がコミット時のステージ内容ではなく、整形後の内容になっていること

3. **lint エラーシナリオ**:
   - 例えば未使用変数(Biome `correctness/noUnusedVariables`) を含むコードをステージ
   - `git commit` が失敗し、エラー出力に Biome のメッセージが出ること
   - 修正してから再コミットすると成功すること

4. **対象外拡張子シナリオ**:
   - `*.md` のみのステージで `git commit` が、Biome 起動なく成功すること(glob 不一致のため job がスキップされる、または `--no-errors-on-unmatched` で空入力を許容)

5. **CI との整合**:
   - PR 作成後 GitHub Actions の `lint-and-typecheck` が緑であること(lefthook の影響を受けない)

## 依存ライブラリ

### 追加

```json
{
  "devDependencies": {
    "lefthook": "^1.x"
  }
}
```

### 削除

なし。

## ディレクトリ構造の変化

```
lgtmhub/
├── lefthook.yml          ← 新規
├── package.json          ← scripts に prepare 追加 / devDependencies に lefthook 追加
├── package-lock.json     ← 再生成(lefthook と transitive deps の追加)
├── .git/hooks/           ← npm install 後 lefthook により自動更新(コミット対象外)
└── docs/
    └── development-guidelines.md ← lefthook の説明を追記
```

## 想定される失敗ケースとロールバック

| 失敗 | ロールバック方針 |
|---|---|
| `lefthook install` が CI で失敗する | `prepare` スクリプトを `lefthook install \|\| true` 等で握り潰すか、`scripts.postinstall` への移動を検討。最終手段は `prepare` を別 npm スクリプト(`hook:install` 等)に切り出して手動実行させる |
| `biome check --write` が想定外のファイルを書き換える | `glob` を更に絞る、または `--files-ignore-unknown=true` の挙動を確認 |
| `stage_fixed: true` で意図せぬファイルがステージされる | `glob` で対象を更に厳格化。事故時は `git restore --staged <path>` で個別解除 |
| 既存の整形済みコードに想定外の lint エラーが出る | `biome.json` の linter ルールを調整(本タスクでは Biome 既存設定を尊重し、調整は別 issue) |

## セキュリティ考慮事項

- lefthook は単一の Go バイナリとして配布される(npm パッケージは prebuilt バイナリを取得)。`postinstall` でリモートのバイナリをダウンロードする挙動はないため、サプライチェーン上のリスクは小さい。
- `git commit --no-verify` の使用ガイドラインを明記し、フックの形骸化を防ぐ。

## パフォーマンス考慮事項

- Biome は Rust 実装のため、staged files が数十ファイルでも数百 ms で完了する見込み。
- lefthook の起動オーバーヘッド (Go バイナリの起動) は数十 ms 程度。
- 体感的には「コミットが少し止まる」程度で、開発者体験を著しく損なわない想定。

## 将来の拡張性

- `pre-push` フックでの `npm run typecheck` 実行は、push 時の品質ゲートとして有効。導入可否は別 issue で検討。
- `commit-msg` フックでコミットメッセージ規約(日本語タイトル + 箇条書き) を強制する選択肢もあるが、現状は手動運用で十分。
- 将来テストファイルが増えたら、staged files に紐づく対象テストだけ実行する `pre-commit` job を追加できる。

## 実装の順序

### フェーズ 1: lefthook 導入

1. `lefthook` を `npm install -D` で devDependencies に追加
2. `package.json` に `prepare` スクリプト(`lefthook install`)を追加
3. `lefthook install` が成功し `.git/hooks/pre-commit` が配置されることを確認

### フェーズ 2: lefthook.yml 作成

4. `lefthook.yml` を作成し pre-commit ジョブを定義
5. `npx lefthook run pre-commit` でドライ実行(staged が無い状態でも error free)

### フェーズ 3: 動作検証

6. 整形が必要なファイルをステージして `git commit` し、整形差分が反映されたコミットになることを確認
7. lint エラーを意図的に作って `git commit` し、コミットが失敗することを確認
8. 対象外拡張子(`*.md`) のみのコミットがスキップされ成功することを確認

### フェーズ 4: ドキュメント更新

9. `docs/development-guidelines.md` に導入手順と動作概要を追記
10. README に lefthook 言及を追記(任意)

### フェーズ 5: 全体検証と PR 作成

11. `npm run lint` / `npm run typecheck` / `npm test` が成功することを確認
12. CI が緑になることを確認(PR 経由)
