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

## フェーズ1: リポジトリ層（書き込みメソッド追加）

- [x] `UserProfileRepository.updateAuthFields(userId, fields)` を追加
  - [x] camelCase フィールド（`avatarUrl?` / `displayName?`）を snake_case の Update オブジェクトへ変換（`undefined` は除外、`as`/`any` 不使用）
  - [x] `.from('user_profiles').update(patch).eq('id', userId).select('*').single()` を実装
  - [x] `error` 時は `DatabaseError` を throw、`data` を既存 `toUserProfile` でマップして返す
- [x] リポジトリのユニットテストを追加（`tests/unit/repositories/user-profile-repository.test.ts`）
  - [x] `from('user_profiles')` / `update(patch)` / `eq('id', userId)` / `select('*').single()` のチェーン検証
  - [x] 更新後の `UserProfile` マップ結果を検証
  - [x] error 時に `DatabaseError` を throw することを検証

## フェーズ2: サービス層（syncFromAuth 実装）

- [x] `UserProfileService.syncFromAuth(userId, meta)` を追加
  - [x] `meta`(unknown) から string を安全に取り出す型ガード `readString` を実装
  - [x] `avatarUrl` を `avatar_url` から抽出
  - [x] `displayName` を `full_name → name → user_name` の優先順位で導出
  - [x] 抽出できたフィールドのみパッチ化、空なら repo を呼ばず `null` を返す
  - [x] `userProfileRepo.updateAuthFields(userId, fields)` を呼び結果を返す
- [x] サービスのユニットテストを追加（`tests/unit/services/user-profile-service.test.ts`）
  - [x] `full_name` 優先で `displayName` 導出 → repo 呼び出し引数検証
  - [x] `name` / `user_name` フォールバック導出
  - [x] `avatar_url` のみ存在時に `{ avatarUrl }` のみで更新
  - [x] 該当キーが無い / `meta` が非 object のとき repo を呼ばず `null`

## フェーズ3: コールバック連携

- [x] `app/api/auth/callback/route.ts` に同期呼び出しを追加
  - [x] `exchangeCodeForSession` 成功後に `supabase.auth.getUser()` でユーザー取得
  - [x] `buildUserProfileService(supabase).syncFromAuth(user.id, user.user_metadata)` を呼ぶ
  - [x] `try/catch` で同期失敗を握りつぶし、`response`（リダイレクト）は必ず返す

## フェーズ4: 品質チェックと修正

- [x] すべてのテストが通ることを確認
  - [x] `pnpm run test`（255 passed / 20 files。ローカルは `node_modules/.bin/vitest run` で実行）
- [x] リント/フォーマットエラーがないことを確認
  - [x] `pnpm run check`（`node_modules/.bin/biome check`、変更5ファイル clean）
- [x] 型エラーがないことを確認
  - [x] `pnpm run typecheck`（`node_modules/.bin/tsc --noEmit` exit 0）

## フェーズ5: 検証とドキュメント

- [x] implementation-validator による品質検証をパス（Critical なし。W1/W2/N1 の指摘を反映）
- [x] 実装後の振り返り（このファイルの下部に記録）

---

## 実装後の振り返り

### 実装完了日
2026-07-18

### 計画と実績の差分

**計画と異なった点**:
- コールバックでのユーザー取得を、当初計画の `supabase.auth.getUser()` から
  `exchangeCodeForSession` の戻り値 `data.user` の再利用に変更した。
  検証（implementation-validator）で「getUser の追加ラウンドトリップは実質不要」と
  指摘され（W2）、ログイン毎のネットワーク往復を1回削減。design.md も更新済み。

**新たに必要になったタスク**:
- callback route の unit テスト追加（W1）。当初は「既存 e2e でカバー」としていたが、
  実際の `tests/e2e/auth-callback.test.ts` は storageState を読むだけで callback ルートを
  経由しないため、新規分岐（getUser→syncFromAuth、失敗時もリダイレクト、open redirect 防止）が
  未検証だった。`tests/unit/api/auth-callback.test.ts` を新設し6ケースで担保。
- `readString` に空文字ガード追加（N1）。空文字を「未設定」として弾き、既存値の空上書きを防止。
  対応する service テストケースも追加。

**技術的理由でスキップしたタスク**（該当する場合のみ）:
- なし（全タスク完了）。

### 学んだこと

**技術的な学び**:
- `exchangeCodeForSession` の戻り値 `AuthTokenResponse` は `data.user` を含むため、
  直後の `getUser()` は冗長。認証直後にユーザー情報が要るときは exchange の戻り値を使う。
- `user_profiles` は `display_name`/`avatar_url` が NOT NULL。GitHub 側変更の同期では
  「抽出できたフィールドのみの部分 UPDATE + 空文字除外」により NOT NULL 違反も空上書きも回避できる。
- `handle_new_user` トリガの導出優先順位（`full_name → name → user_name`）にアプリ層を揃えることで、
  初回作成と差分同期で表示名の決まり方が一致する。

**プロセス上の改善点**:
- ローカルは pnpm のバージョン切替（v11.9.0）が壊れており `pnpm run *` が失敗するため、
  `node_modules/.bin/{tsc,vitest,biome}` を直接叩いて検証した。corepack pnpm は node_modules の
  再インストールを促すため避けた。
- 検証サブエージェントの指摘（W/N）を計画（design.md）に反映してから実装し直すことで、
  設計ドキュメントと実装の乖離を防げた。

### 次回への改善提案
- route handler を新規に触る変更では、e2e が実際にそのルートを経由するか最初に確認する。
  経由しないなら unit テストを計画時点でタスク化する。
- 外部由来（user_metadata 等）の string 取り込みは「型 + 非空」を既定のガードにする。
