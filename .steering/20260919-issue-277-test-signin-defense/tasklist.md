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

- [ ] `pnpm run check` が通る
- [ ] `pnpm run typecheck` が通る
- [ ] `pnpm run test` が通る

## フェーズ5: ドキュメント更新

- [ ] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
{YYYY-MM-DD}

### 計画と実績の差分

**計画と異なった点**:
- {計画時には想定していなかった技術的な変更点}

**新たに必要になったタスク**:
- {実装中に追加したタスク}

### 学んだこと

**技術的な学び**:
- {実装を通じて学んだ技術的な知見}

**プロセス上の改善点**:
- {タスク管理で良かった点}

### 次回への改善提案
- {次回の機能追加で気をつけること}
