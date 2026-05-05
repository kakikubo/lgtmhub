# タスクリスト: Danger による PR 変更行数チェック

## 実装タスク

- [x] `danger` を devDependency として `package.json` に追加し、`npm install` を実行して `package-lock.json` を更新する
- [x] `dangerfile.ts` を新規作成し、プロダクションコードの追加・変更行数 / 変更ファイル数を集計して warning を出すロジックを実装する
- [x] `.github/workflows/danger.yml` を新規作成し、`pull_request` イベントで `npx danger ci` を実行する workflow を定義する
- [x] `tsconfig.json` / `biome.json` の include / exclude を確認し、`dangerfile.ts` が typecheck / lint 対象に含まれていることを担保する（必要なら設定を更新する）
- [x] `docs/development-guidelines.md` の「PRの大きさの目安」に Danger 自動チェックに関する記述を追記する

## 検証タスク

- [x] `npm run lint` が成功することを確認する
- [x] `npm run typecheck` が成功することを確認する
- [x] `npm test` が成功することを確認する（既存テストへの非影響を確認）
- [x] `npx danger ci --help` 等で danger CLI がインストールされていることを確認する
- [x] 振り返り（実装完了日 / 計画と実績の差分 / 学んだこと / 改善提案）を本ファイル末尾に追記する

---

## 振り返り

### 実装完了日

2026-05-05

### 計画と実績の差分

- 計画通りに完了。`dangerfile.ts` / `.github/workflows/danger.yml` / `package.json` 更新 / `docs/development-guidelines.md` 追記の 4 点。
- 計画外で `tsconfig.json` / `biome.json` への変更は不要だった（tsconfig は `**/*.ts` を include、biome は除外パターンに該当しない）。
- implementation-validator の指摘（低優先度 2 件）を反映し、`countDiffLines` の意図コメントを追加し、workflow trigger を `ci.yml` と揃えて `edited` を除外した。

### 学んだこと

- danger-js では `dangerfile.ts` の中で `import { danger, warn } from 'danger'` と書いても、ランタイムが import を置換して global の DSL を注入する仕組みになっている。型のためだけに import を残しておくのが定石。
- `danger.git.diffForFile()` が返す `added` / `removed` は、`+` / `-` の prefix を含まない「該当行のコンテンツのみ」を `os.EOL` で結合した文字列。空文字列のときに `split('\n').length` が 1 を返す罠があり、danger-js 自身の `linesOfCode` も明示ガードしている。
- Danger は PR 本体の API 書き込みが副作用になるため、`ci.yml` の lint/test/e2e と独立 workflow にすると障害分離がしやすい。

### 次回への改善提案

- `INCLUDE_PREFIXES` / `EXCLUDE_PATTERNS` / 閾値が `docs/development-guidelines.md` の値と乖離しないよう、片方を変えたら片方も更新するチェックを将来追加してもよい（例: ガイドラインの該当セクションを変更した PR でだけ Danger に「dangerfile も更新したか？」を出す）。
- フォーク PR からの実行は `secrets.GITHUB_TOKEN` の権限制約で警告コメントを書き込めない。本リポジトリはフォーク運用ではないため一旦スコープ外としたが、OSS 化を検討する段階で `pull_request_target` 化や `--no-publish-check` 等の対策を追加検討する。
- 行数閾値に近い PR で「あと何行で警告か」を表示する、行数が小さければ message で OK 表示するなどの拡張余地はあるが、いずれもガイドラインの本旨（人手確認の負荷削減）を超えるため別 issue で扱う。
