# タスクリスト

## 🚨 タスク完全完了の原則

**このファイルの全タスクが完了するまで作業を継続すること**

### 必須ルール
- **全てのタスクを`[x]`にすること**
- 「時間の都合により別タスクとして実施予定」は禁止
- 「実装が複雑すぎるため後回し」は禁止
- 未完了タスク（`[ ]`）を残したまま作業を終了しない

---

## フェーズ1: ルートガード

- [x] `app/api/auth/test-signin/route.ts` の `isE2ETestMode()` を `isTestSigninEnabled()` に置き換える
  - [x] `E2E_TEST_MODE === 'true'` 以外は false
  - [x] `VERCEL_ENV === 'production'` は false
  - [x] リクエスト時に `process.env` を読む
  - [x] コメントを多層防御の実態に合わせて更新する

## フェーズ2: ユニットテスト

- [x] `tests/unit/api/auth-test-signin.test.ts` の `beforeEach` で `VERCEL_ENV` もクリアする
- [x] `E2E_TEST_MODE=true` + `VERCEL_ENV=production` で 403 になるケースを追加する
- [x] `E2E_TEST_MODE=true` + `VERCEL_ENV=preview` で 200 になるケースを追加する
- [x] `E2E_TEST_MODE=true` + `NODE_ENV=production` + `VERCEL_ENV` 未設定で 200 になるケースを追加する

## フェーズ3: ドキュメント

- [x] `README.md` の本番注記を `VERCEL_ENV` ガード込みに更新する
- [x] `docs/development-guidelines.md` の E2E 注意書きを更新する
- [x] `docs/architecture.md` のアクセス制御に本番ガードを追記する

## フェーズ4: 品質チェック

- [x] `pnpm run check` が通る
  - 変更ファイル単体はパス。リポジトリ全体の `pnpm run check` は未変更の `tests/unit/lib/image/compose-lgtm.test.ts` の format 差分で失敗する（Issue #306 の既存問題）
- [x] `pnpm run typecheck` が通る
- [x] `pnpm run test` が通る（43 files / 422 tests）

## フェーズ5: ドキュメント更新

- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-09-18

### 計画と実績の差分

**計画と異なった点**:
- `NODE_ENV=production` の回帰テストで `process.env.NODE_ENV` へ直接代入すると `tsc` が read-only と判定したため、既存の `regenerate-route.test.ts` と同じ `vi.stubEnv` / `vi.unstubAllEnvs` に切り替えた。
- リポジトリ全体の `pnpm run check` は今回の変更とは無関係な biome format 差分で失敗する。変更ファイルへの `biome check` と `typecheck` / `test` で品質を確認した。

**新たに必要になったタスク**:
- `NODE_ENV` 代入を `vi.stubEnv` に置き換える（型エラー回避）

### 学んだこと

**技術的な学び**:
- `@types/node` では `process.env.NODE_ENV` が read-only のため、テストで差し替えるなら `vi.stubEnv` が正しい。
- Vercel 本番の判定は `NODE_ENV` ではなく `VERCEL_ENV` を使う。Next.js の `pnpm start` も `NODE_ENV=production` になる。

**プロセス上の改善点**:
- issue 本文の「NODE_ENV=production で 403」をそのまま実装すると CI e2e が壊れる。計画時に Playwright の `webServer.command` を確認して方針を確定できた。

### 次回への改善提案
- Issue #306 の biome format 差分を先に直すと、以降の PR で `pnpm run check` を品質ゲートとして使える。
