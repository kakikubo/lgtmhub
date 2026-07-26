# 設計書

## アーキテクチャ概要

既存のレイヤー構造（app → src/services → src/repositories → src/lib）に沿って、書き込み経路をサービス経由で追加する。DB スキーマ変更は無い（列は既存）。

```
[OAuth コールバック route]
  app/api/auth/callback/route.ts
        │ exchangeCodeForSession 成功後
        │ supabase.auth.getUser()
        ▼
  buildUserProfileService(supabase).syncFromAuth(userId, user_metadata)
        ▼
[Service] UserProfileService.syncFromAuth
        │ user_metadata(unknown) から型ガードで抽出
        │ display_name を coalesce 導出、部分パッチ生成
        │ 更新対象が空なら早期リターン
        ▼
[Repository] UserProfileRepository.updateAuthFields
        │ .update(snake_case patch).eq('id', userId).select('*').single()
        │ error → DatabaseError
        ▼
   user_profiles (RLS: auth.uid() = id で自分の行のみ UPDATE 可)
   updated_at は before update トリガで自動更新
```

## コンポーネント設計

### 1. UserProfileRepository.updateAuthFields（新規メソッド）

**責務**:
- `user_profiles` の該当行を部分更新し、更新後の `UserProfile` を返す
- DB エラーを `DatabaseError` に変換する

**シグネチャ（案）**:
```ts
async updateAuthFields(
  userId: string,
  fields: { avatarUrl?: string; displayName?: string },
): Promise<UserProfile>
```

**実装の要点**:
- 受け取った camelCase フィールドのうち `undefined` でないものだけを snake_case の Update オブジェクトに詰める
  （`Database['public']['Tables']['user_profiles']['Update']` を利用。`as`/`any` は使わない）
- `.from('user_profiles').update(patch).eq('id', userId).select('*').single()`
- `if (error) throw new DatabaseError(error.message)`、`data` を既存の `toUserProfile` でドメイン型へマップ
- 空パッチはサービス側で弾く前提だが、リポジトリでも `Object.keys(patch).length === 0` の防御は行わない（サービスが早期リターン）

### 2. UserProfileService.syncFromAuth（新規メソッド）

**責務**:
- `user.user_metadata`（`unknown` 相当）から `avatar_url` / `display_name` を安全に抽出
- `display_name` を `full_name → name → user_name` の優先順位で導出
- 抽出できたフィールドのみ部分更新。更新対象が無ければリポジトリを呼ばず `null` を返す

**シグネチャ（案）**:
```ts
async syncFromAuth(userId: string, meta: unknown): Promise<UserProfile | null>
```

**実装の要点**:
- ローカルの型ガード `readString(obj, key): string | undefined` を用意し、`meta` が object であることを確認してから各キーを取り出す
  （`as`/`any` 禁止、`unknown` + 型ガードで絞り込む方針に準拠）
- 抽出ロジック:
  - `avatarUrl = readString(meta, 'avatar_url')`
  - `displayName = readString(meta, 'full_name') ?? readString(meta, 'name') ?? readString(meta, 'user_name')`
- `fields` に `undefined` でないものだけ入れ、`Object.keys(fields).length === 0` なら `return null`
- それ以外は `this.userProfileRepo.updateAuthFields(userId, fields)` を返す

### 3. OAuth コールバック連携

**責務**:
- exchange 成功後にユーザーを取得し、サービスの同期を呼ぶ
- 同期の失敗がログインを壊さないよう握りつぶす

**実装の要点**:
- `exchangeCodeForSession` の戻り値 `data.user` をそのまま使う（`getUser()` の追加ラウンドトリップを避ける。検証時の指摘 W2 を反映）:
  ```ts
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) { /* exchange_failed リダイレクト */ }
  try {
    const { user } = data;
    if (user) {
      await buildUserProfileService(supabase).syncFromAuth(user.id, user.user_metadata);
    }
  } catch {
    // 同期失敗はログインを阻害しない（必要なら将来 Sentry 連携）
  }
  ```
- ルートは独自の `createServerClient`（cookie を response に書く）を保持しているため、その `supabase` インスタンスをそのままサービスへ渡す（`createClient()` を新規生成しない）

## データフロー

### OAuth ログイン時のプロフィール同期
```
1. GitHub からリダイレクトで /api/auth/callback?code=... に到達
2. exchangeCodeForSession(code) が成功しセッション確立、戻り値 data.user を取得
3. （getUser の追加往復はしない。data.user をそのまま使用）
4. syncFromAuth(user.id, user.user_metadata) を呼ぶ
5. サービスが avatar_url / display_name を抽出・導出し部分パッチ生成
6. パッチが空でなければ repo.updateAuthFields で user_profiles を UPDATE
7. response（リダイレクト）を返す。3〜6 で例外が出ても 7 は必ず実行
```

## エラーハンドリング戦略

### カスタムエラークラス
- 新規追加なし。リポジトリは既存 `DatabaseError`（`src/lib/errors.ts`）を throw
- HTTP ステータス変換は `app/api` 層のみの責務。コールバックでは同期エラーを **catch して握りつぶす**（ログインを阻害しない設計方針）

### エラーハンドリングパターン
- リポジトリ: `if (error) throw new DatabaseError(error.message)`
- サービス: エラーはそのまま伝播（リポジトリの `DatabaseError`）
- コールバック: `try/catch` で同期を包み、失敗しても `response` を返す

## テスト戦略

### ユニットテスト
- `tests/unit/services/user-profile-service.test.ts` に追記:
  - `syncFromAuth`: `full_name` 優先で `displayName` 導出 → repo 呼び出し引数検証
  - `name` フォールバック / `user_name` フォールバックの導出
  - `avatar_url` のみ存在 → `{ avatarUrl }` のみで更新
  - 該当キーが1つも無い / `meta` が非 object → repo を呼ばず `null` を返す
- `tests/unit/repositories/user-profile-repository.test.ts` に追記:
  - `updateAuthFields`: `from('user_profiles')` → `update(patch)` → `eq('id', userId)` → `select('*').single()` のチェーン検証、`toUserProfile` マップ結果
  - error 時に `DatabaseError` を throw

### 統合テスト
- 既存 `tests/e2e/auth-callback.test.ts` の範囲で担保（新規追加はスコープ外）

## 依存ライブラリ

新規追加なし。

## ディレクトリ構造

```
src/repositories/user-profile-repository.ts   (updateAuthFields 追加)
src/services/user-profile-service.ts          (syncFromAuth 追加)
app/api/auth/callback/route.ts                (getUser + syncFromAuth 呼び出し追加)
tests/unit/repositories/user-profile-repository.test.ts  (テスト追加)
tests/unit/services/user-profile-service.test.ts          (テスト追加)
```

## 実装の順序

1. リポジトリに `updateAuthFields` を追加
2. リポジトリのユニットテストを追加
3. サービスに `syncFromAuth` を追加
4. サービスのユニットテストを追加
5. コールバックから `getUser` + `syncFromAuth` を呼び出す
6. `pnpm run check` / `typecheck` / `test` を通す

## セキュリティ考慮事項

- 書き込みはルートの認証済み `supabase`（RLS: `auth.uid() = id`）経由のため、他人の行は更新できない
- `user_metadata` は信頼できない外部由来だが、対象は自分の `avatar_url` / `display_name` のみ。値は string 型ガードで検証し、それ以外は無視
- オープンリダイレクト対策（`safeNext`）は既存のまま変更しない

## パフォーマンス考慮事項

- 追加コストはログイン毎に `getUser()` 1回と `update` 最大1回のみ。値が無ければ update をスキップ
- 差分検知（現行値と比較して変化時のみ update）は行わず、常に部分 UPDATE する（`updated_at` トリガのみ発火、実害は軽微。将来最適化余地として記録）

## 将来の拡張性

- Sentry 連携（Issue #175 進行中）が入ったら、コールバックの catch 節で同期失敗を計測に送る
- `github_login` の同期が必要になれば、unique 制約を考慮のうえ `syncFromAuth` のパッチ対象を拡張
