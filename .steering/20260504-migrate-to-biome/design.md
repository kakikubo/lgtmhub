# 設計書

## アーキテクチャ概要

Linter / Formatter を Biome v2 系の単一ツールに統合する。Biome 公式が提供する自動マイグレーションコマンドを起点に、現状の Prettier / ESLint 設定を `biome.json` に集約する。

```
┌────────────── Before ──────────────┐    ┌─────── After ────────┐
│ ESLint(eslint.config.mjs)          │    │ Biome v2             │
│   └ next/core-web-vitals           │    │  ├─ Linter           │
│   └ next/typescript                │ →  │  ├─ Formatter        │
│ Prettier(.prettierrc)              │    │  └─ biome.json (1個) │
│   .prettierignore                  │    │                       │
└────────────────────────────────────┘    └───────────────────────┘
```

## コンポーネント設計

### 1. `biome.json`(新規)

**責務**:
- Linter / Formatter の挙動を一元管理
- 旧 `.prettierignore` / `eslint.config.mjs` の `ignores` を統合した除外パスを宣言

**実装の要点**:
- `$schema` でバージョン固定(VS Code 補完を効かせる)
- Prettier ルールの 1:1 写像(下表)
- Linter は `recommended: true` をベースとし、`next/core-web-vitals` の代替ルールを段階的に有効化
- Indent は `indentStyle: "space"` / `indentWidth: 2` に明示設定(Biome デフォルトは `tab` のため、現状の Prettier フォーマットとの差分を防ぐ)

**Prettier → Biome のキー対応**:

| Prettier(`.prettierrc`) | Biome(`biome.json`) | 備考 |
|---|---|---|
| `semi: true` | `javascript.formatter.semicolons: "always"` | Biome デフォルト |
| `singleQuote: true` | `javascript.formatter.quoteStyle: "single"` | デフォルトは `double`、明示が必要 |
| `printWidth: 100` | `formatter.lineWidth: 100` | デフォルトは `80` |
| `trailingComma: "all"` | `javascript.formatter.trailingCommas: "all"` | Biome デフォルト |
| `arrowParens: "always"` | `javascript.formatter.arrowParentheses: "always"` | Biome デフォルト |
| (未指定 = 2 spaces) | `formatter.indentStyle: "space"` / `formatter.indentWidth: 2` | デフォルトは tab。**明示必須** |

**ignore パス統合** (`files.includes` の negation で表現):

| 旧 | 出典 | 統合後 |
|---|---|---|
| `node_modules/**` | eslint, prettier | `!node_modules/**` |
| `.next/**` | eslint, prettier | `!.next/**` |
| `coverage/**` | eslint, prettier | `!coverage/**` |
| `playwright-report/**` | eslint, prettier | `!playwright-report/**` |
| `test-results/**` | eslint, prettier | `!test-results/**` |
| `supabase/migrations/**` | eslint, prettier | `!supabase/migrations/**` |
| `src/types/database.types.ts` | eslint, prettier | `!src/types/database.types.ts` |
| `next-env.d.ts` | eslint | `!next-env.d.ts` |

### 2. `package.json`(更新)

**責務**:
- 新スクリプトの提供と旧依存の削除

**実装の要点**:

```diff
 "scripts": {
   "dev": "next dev",
   "build": "next build",
   "start": "next start",
-  "lint": "next lint",
+  "lint": "biome lint .",
+  "format": "biome format --write .",
+  "check": "biome check .",
   "typecheck": "tsc --noEmit",
   ...
 }
```

```diff
 "devDependencies": {
+  "@biomejs/biome": "^2.4.0",
-  "eslint": "^9.0.0",
-  "eslint-config-next": "~15.5.15",
-  "prettier": "^3.3.0",
   ...
 }
```

- `lint` は CI でも使うため `biome lint .`(差分検出のみ、書き換えなし)
- `format` はローカル整形用に `--write` 付き
- `check` は lint + format を 1 コマンドで(将来 CI で `biome ci` に切り替える余地)
- 旧依存削除に伴い `package-lock.json` を `npm install` で再生成

### 3. `.github/workflows/ci.yml`(更新)

**責務**:
- CI の lint ステップを Biome に切り替え

**実装の要点**:
- `lint-and-typecheck` ジョブの `npm run lint` のままで、内部実装(`next lint` → `biome lint .`)が切り替わる構造を採用
  - YAML 上の差分は最小化(スクリプト経由のため)
- 他ジョブ(`test`/`e2e`/`security`) は変更しない

### 4. `.devcontainer/devcontainer.json`(更新)

**責務**:
- VS Code 拡張・エディタ設定を Biome 前提に

**実装の要点**:

```diff
 "extensions": [
-  "dbaeumer.vscode-eslint",
-  "esbenp.prettier-vscode",
+  "biomejs.biome",
   "bradlc.vscode-tailwindcss",
   "denoland.vscode-deno"
 ],
 "settings": {
   "editor.formatOnSave": true,
-  "editor.defaultFormatter": "esbenp.prettier-vscode",
+  "editor.defaultFormatter": "biomejs.biome",
   "editor.codeActionsOnSave": {
-    "source.fixAll.eslint": "explicit"
+    "quickfix.biome": "explicit",
+    "source.organizeImports.biome": "explicit"
   }
 }
```

### 5. 削除対象ファイル

- `eslint.config.mjs`
- `.prettierrc`
- `.prettierignore`

### 6. `docs/development-guidelines.md`(更新)

**責務**:
- フォーマット規約セクション・CI 例 / npm scripts 例を Biome 前提に書き換え

**実装の要点**:
- 「フォーマット規約」セクションの Prettier 設定表を Biome 設定表に置換
- 「ESLint基本方針」を「Biome lint 方針」にリネーム・本文更新
- CI/CDパイプライン > GitHub Actions の例コードと npm scripts 例を更新
- セルフレビューチェックリストの `npm run lint` 言及はそのまま(コマンド名は不変)

### 7. `docs/architecture.md`(更新)

**責務**:
- 開発ツール表と依存関係管理表の Biome 反映

**実装の要点**:
- 「開発ツール」表の `ESLint` / `Prettier` 行を `Biome` 1 行に統合(バージョン: `2.x`、用途: リンター + フォーマッター)
- 「依存関係管理 > バージョン管理方針」の `devDependencies` から `eslint`/`prettier` を削除し `@biomejs/biome` を追加
- それ以外の章(レイヤード設計、データ永続化、セキュリティ等) には影響しない

## データフロー

### 開発者ワークフロー

```
1. コード変更
2. エディタ保存 → Biome が VS Code 拡張経由で format-on-save を実行
3. コミット前: `npm run lint` で違反確認(任意)
4. PR 作成 → CI で `npm run lint` (= biome lint) と typecheck / test が走る
```

### CI ワークフロー

```
push / pull_request
  └─ lint-and-typecheck job
       ├─ npm ci
       ├─ npm run lint     ← biome lint .
       └─ npm run typecheck
```

## エラーハンドリング戦略

本タスクは設定変更のため、ランタイムのエラーハンドリングには影響しない。

ただし以下のリスクシナリオは設計時に考慮する:

| リスク | 対処 |
|---|---|
| 既存コードに Biome 違反が大量発生 | `biome check --write` で一括自動修正後、残った違反のみ手動対応 |
| 既存フォーマットと Biome 出力に差分 | `biome migrate prettier --write` で生成された設定を適用後、差分が大きいファイルがあれば `biome.json` を微調整 |
| `next/core-web-vitals` 由来ルール喪失による品質低下 | requirements.md の方針通り、PR レビュー + `next build` 警告で担保 |
| CI で大量の既存違反を検出して落ちる | フェーズ 2-3 で `biome check --write` を一度実行し、整形コミットを分離 |

## テスト戦略

### 動作確認(本タスクではユニットテストは追加しない)

- [ ] `npx biome --version` が成功
- [ ] `npm run lint` がエラーゼロで完了
- [ ] `npm run format` 実行後、git diff が空(整形コミット後)
- [ ] `npm run typecheck` 成功
- [ ] `npm run build` 成功
- [ ] `npm run test:unit` / `test:integration` 成功
- [ ] `npm run test:e2e` 成功(ローカル環境)
- [ ] CI(GitHub Actions) の `lint-and-typecheck` が緑

### 既存テストへの影響確認

- 既存の `tests/unit/` `tests/integration/` `tests/e2e/` のコードが Biome により再フォーマットされるが、ロジックは不変
- `npm run test` 系の挙動は変わらない想定

## 依存ライブラリ

### 追加

```json
{
  "devDependencies": {
    "@biomejs/biome": "^2.4.0"
  }
}
```

### 削除

```json
{
  "devDependencies": {
    "eslint": "^9.0.0",
    "eslint-config-next": "~15.5.15",
    "prettier": "^3.3.0"
  }
}
```

## ディレクトリ構造

```
lgtmhub/
├── biome.json                   ← 新規
├── package.json                 ← scripts / devDependencies 更新
├── package-lock.json            ← 再生成
├── eslint.config.mjs            ← 削除
├── .prettierrc                  ← 削除
├── .prettierignore              ← 削除
├── .devcontainer/
│   └── devcontainer.json        ← 拡張・設定更新
├── .github/workflows/
│   └── ci.yml                   ← 変更なし(npm scripts 経由のため)
└── docs/
    ├── architecture.md          ← 開発ツール表 / 依存関係表 更新
    └── development-guidelines.md ← フォーマット規約セクション全面書き換え
```

## 実装の順序

設定移行と既存コードへの影響を切り分けるため、以下の順序で進める。**整形コミットと依存変更コミットを分離**することで、後からの差分追跡を容易にする。

### フェーズ 1: Biome 導入と設定生成

1. `@biomejs/biome` を `npm install -D` で追加
2. `npx biome init` で雛形生成
3. `npx biome migrate prettier --write` で `.prettierrc` を取り込み
4. `npx biome migrate eslint --write` で `eslint.config.mjs` を取り込み(可能な範囲)
5. 生成された `biome.json` を手動調整(ignore パス統合・lineWidth 等を確認)

### フェーズ 2: 既存コードの整形(独立コミット)

6. `npx biome check --write .` で全コードを Biome 基準に整形
7. 整形差分のみで 1 コミット作成(挙動変更なしを明示)

### フェーズ 3: スクリプト・CI・エディタ統合

8. `package.json` の scripts を更新(`lint`/`format`/`check` 追加・差し替え)
9. `.devcontainer/devcontainer.json` の拡張・エディタ設定を更新

### フェーズ 4: 旧ツール削除

10. `package.json` の devDependencies から `eslint*` / `prettier` を削除
11. `eslint.config.mjs` / `.prettierrc` / `.prettierignore` を削除
12. `npm install` で `package-lock.json` を再生成

### フェーズ 5: ドキュメント更新

13. `docs/development-guidelines.md` のフォーマット規約 / CI 例 / npm scripts 例を更新
14. `docs/architecture.md` の開発ツール表 / 依存関係管理表を更新

### フェーズ 6: 全体検証

15. `npm run lint` / `format` / `typecheck` / `build`
16. `npm run test:unit` / `test:integration` / `test:e2e`
17. CI 動作確認(PR 作成して GitHub Actions が緑になることを確認)

## セキュリティ考慮事項

- Biome は依存 0(単一バイナリ配布)のため、サプライチェーン上のリスク面は ESLint+Prettier 構成より小さい
- `npm audit` での脆弱性検出は CI で継続(security ジョブは変更なし)

## パフォーマンス考慮事項

- Biome は Rust 実装のため lint/format の所要時間が短縮される(成功指標として実測値を記録)
- CI の `lint-and-typecheck` ジョブの所要時間が短縮される見込み(計測対象)

## 将来の拡張性

- 本スコープでは Tailwind 並び替えと `next/core-web-vitals` 固有ルールは対応外
- Oxfmt が 1.0 stable に達した時点で OXC への再移行を別 issue として再評価する余地を残す
- Biome v3 系登場時はマイナーアップデートではなくメジャーバージョンアップとして別 issue で対応

## 想定される失敗ケースとロールバック

| 失敗 | ロールバック方針 |
|---|---|
| 既存コードの整形差分が大きすぎてレビュー困難 | フェーズ 2 のコミットを単独 PR にして先行マージ。本 PR は設定移行のみに絞る |
| Biome 違反が解消困難で CI が通らない | 違反ルールを `biome.json` で `"off"` に下げ、別 issue で恒久対応 |
| `biome migrate eslint` が想定外の設定を生成 | `biome.json` を手書きで再構築(本ドキュメントの設定対応表が一次情報) |
| Next.js プラグイン由来の重要ルール喪失で品質低下 | `next build` の警告を CI で fail させるオプションを別 issue で検討 |
