# タスクリスト

## 実装タスク

- [x] T1 `docs/development-guidelines.md` の「Route Handler のパターン」セクション末尾を確認し、挿入位置を確定する
- [x] T2 「Server Action のパターン」サブセクションの本文を書く（使い分け基準 / 基本サンプル / 呼び出し側 / 注意ボックス / open redirect ガード）
- [x] T3 サンプルコードを `src/lib/auth/actions.ts` と `app/api/auth/callback/route.ts` から抽象化して埋め込む（実コードを転記するのではなく、不要なコメントは削る）
- [x] T4 既存の Route Handler 節とトーン・粒度・インデントが揃っているか目視レビューする
- [x] T5 `docs/development-guidelines.md` 全体を頭から読み、目次的な流れに不自然がないか確認する

## 検証タスク

- [x] V1 `npm run lint` がパスすることを確認する（`biome lint .` Checked 56 files / No fixes applied）
- [x] V2 `npm run typecheck` がパスすることを確認する（`tsc --noEmit` エラーなし）
- [x] V3 `npm run test` がパスすることを確認する（12 ファイル / 124 テスト全件 pass）
- [x] V4 `implementation-validator` サブエージェントで品質チェックを行う（指摘 2 件対応: `safeNext` コメント括弧を半角に統一 / `redirect()` テスト方法をプロジェクト実コード `__REDIRECT__:` sentinel パターンに合わせて具体化）

## 振り返りタスク

- [x] R1 本ファイル末尾に「申し送り事項」を追記する（実装日 / 計画と実績の差分 / 学んだこと / 次回への改善提案）

---

## 申し送り事項

### 実装完了日
2026-05-05

### 計画と実績の差分

| 項目 | 計画 | 実績 |
|------|------|------|
| サンプルコードのコメント | 実コードのコメントを抽象化して最小化 | `safeNext` を「実コードからの抜粋」と明記したため、原文と完全一致が要求された。括弧を半角に揃える微修正が発生 |
| `redirect()` のテスト方法の記述 | 一般論として `rejects.toThrow(...)` と書く想定 | `tests/unit/lib/auth/actions.test.ts` で実際に使われている `__REDIRECT__:${url}` sentinel パターンを記載。汎用 `.toThrow()` だと redirect 由来の throw か別エラーかの区別ができないため、プロジェクト実コードの `vi.mock('next/navigation', () => ({ redirect: vi.fn(url => { throw new Error(`__REDIRECT__:${url}`); }) }))` パターンを参照付きで紹介する形に変更 |
| 修正対象ファイル | `docs/development-guidelines.md` のみ | 計画通り。コード変更ゼロ |
| 検証 | `npm test` / `lint` / `typecheck` 全パス | 全パス（テスト 124 件 / lint 56 ファイル / tsc clean） |

### 学んだこと

1. **「実コードからの抜粋」と書いた箇所は文字列レベルで一致させる**: 抜粋と明記している以上、半角/全角や空白の違いも実コードとの diff になる。implementation-validator はそこまで照合する。今回は `safeNext` のコメント内の括弧（半角 → 全角）でズレが発生していた。
2. **テスト技法はプロジェクト実コードを正とする**: `redirect()` のテストには Next.js 一般論（`isRedirectError` を import する、`/NEXT_REDIRECT/` で正規表現マッチする）と本プロジェクト実コード（`vi.mock` で sentinel error を throw する）の二系統がある。implementation-validator は前者を提案してきたが、`tests/unit/lib/auth/actions.test.ts` を確認した結果、本プロジェクトは後者を採用している。ガイドラインは実コードと一致させるのが正しい。
3. **rtk 経由の `npm run lint` 出力は ESLint JSON として解釈されエラー風メッセージが出る**: 実態は Biome の人間向け出力。判定は exit code で、`rtk proxy npm run lint` で生出力を確認できる。

### 次回（後続の Server Action 実装、または同種のドキュメント追記）への改善提案

1. **実コード抜粋は元ファイルパス + git rev を併記する選択肢**
   - 例: `// app/api/auth/callback/route.ts (commit 5d00174 時点) より抜粋`
   - 利点: 後でコードが変わってもドキュメントが古いと一目でわかる
   - 短所: 形式が冗長になる。今回は採用していない（変化頻度が低いため）
2. **Server Action のテスト技法を `tests/` 配下にヘルパー化する余地**
   - `__REDIRECT__:${url}` sentinel パターンは複数の Server Action テストで再利用される見込み（後続: 画像登録 / お気に入り）
   - `tests/helpers/mock-redirect.ts` で共通化し、ガイドラインからもそれを参照する形が長期的にはきれい
   - 今回はそこまでスコープに含めず、ヘルパー化はファイル数が増えてからで十分
3. **glossary.md に「Server Action」項目を追加する案**
   - 現状 `Route Handler` / `Server Component` は glossary にあるが Server Action はない
   - スコープ外として今回は追記しないが、画像登録 Server Action 実装時にあわせて追記すると整合性が取れる

### スコープ外として残したもの

- CSRF 対策 / `experimental.serverActions.allowedOrigins` の本番設定（PR #2 申し送り 5 として別途）
- Server Action テスト技法の独立した節やヘルパー（次回提案 2 を参照）
- glossary.md への「Server Action」追加（次回提案 3 を参照）
