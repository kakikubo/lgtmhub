# design.md

## 全体方針

- 既存の `ImageService` / `FavoriteService` (将来) と同じ「Repository を DI で受け取る Service クラス」パターンに合わせる
- `image-service.ts` の `buildImageService(supabase)` ファクトリ関数の慣習に揃え、`buildUserProfileService(supabase)` を提供する
- N+1 回避の責務は **Service ではなく Repository** に持たせる (1クエリ化は Supabase クライアントの `.in()` で実現するため Data Layer の領域)
- `findById` は内部で `findManyByIds([id])` を呼ばず、Repository の `findById` をそのまま委譲する (1件取得は `maybeSingle()` の方が SQL 上明確)

## ファイル変更

### 新規

- `src/services/user-profile-service.ts`
- `tests/unit/services/user-profile-service.test.ts`

### 修正

- `src/repositories/user-profile-repository.ts`
  - `findManyByIds(ids: string[]): Promise<UserProfile[]>` を追加
  - 空配列入力時は即座に `[]` を返す (`supabase.in([])` を発行しない)
- `tests/unit/repositories/user-profile-repository.test.ts`
  - `findManyByIds` のケース追加 (空配列 / 正常 / DB エラー / 部分一致)
- `components/header.tsx`
  - `new UserProfileRepository(supabase).findById(user.id)` →
    `buildUserProfileService(supabase).findById(user.id)` へ
- `docs/repository-structure.md`
  - L165-169 の「例外: Server Component から `UserProfileRepository` を直接呼ぶこと」節を削除
  - 削除した旨を「依存関係」セクションの一般ルールで明示 (Server Component → Service 必須)

## API 設計

### `UserProfileService`

```ts
export interface UserProfileServiceDeps {
  userProfileRepo: UserProfileRepository;
}

export class UserProfileService {
  constructor(deps: UserProfileServiceDeps);

  /** 単一ユーザーのプロフィールを取得する (Header / Layout 用)。 */
  findById(id: string): Promise<UserProfile | null>;

  /**
   * 複数ユーザーのプロフィールを 1 クエリで取得する (画像一覧の N+1 回避用)。
   * - 入力 `ids` が空配列のときは DB を叩かず `[]` を返す
   * - 重複した id は内部で dedupe する (Supabase 側のクエリ最適化と、戻り値の予測可能性のため)
   * - 戻り値は `Map<id, UserProfile>` ではなく配列で返し、呼び出し側で必要なら Map 化する
   *   (Service 層は presentation の都合を持ち込まない)
   */
  findManyByIds(ids: string[]): Promise<UserProfile[]>;
}

export function buildUserProfileService(supabase: SupabaseClient<Database>): UserProfileService;
```

### `UserProfileRepository.findManyByIds` (追加)

```ts
async findManyByIds(ids: string[]): Promise<UserProfile[]> {
  if (ids.length === 0) return [];
  const { data, error } = await this.supabase
    .from('user_profiles')
    .select('*')
    .in('id', ids);
  if (error) throw new DatabaseError(error.message);
  return (data ?? []).map(toUserProfile);
}
```

## Header の移行

Before:
```ts
const profile = user ? await new UserProfileRepository(supabase).findById(user.id) : null;
```

After:
```ts
const profile = user ? await buildUserProfileService(supabase).findById(user.id) : null;
```

import 文も `UserProfileRepository` → `buildUserProfileService` に置き換える。

## ドキュメント更新

`docs/repository-structure.md` の以下を変更する:

- 行 165-169 の「例外: 認証済みユーザーのプロフィール表示用に Server Component から `UserProfileRepository` を直接呼ぶこと」節を **削除**
- 同 173-194 の `src/services/` セクションの配置ファイル一覧に `user-profile-service.ts` を追記
- 同 198-213 の `src/repositories/` の説明はそのまま (例外節が無くなることで自然と Service 経由に統一される)

## テスト戦略

### `UserProfileService` (新規ユニットテスト)

`tests/unit/services/user-profile-service.test.ts` を新設。`ImageService` のテストパターンに合わせ、
`UserProfileRepository` をモックして以下を検証する:

- `findById`: Repository に委譲され、戻り値がそのまま返る (`null` 含む)
- `findManyByIds`: 空配列入力では Repository を呼ばない
- `findManyByIds`: ids を Repository へ伝播する
- `findManyByIds`: Repository の戻り値をそのまま返す
- `buildUserProfileService`: Supabase client から Service が組み立てられる

### `UserProfileRepository.findManyByIds` (既存テストへ追記)

- 空配列なら `[]` を返し Supabase を呼ばない
- 行が複数返ったとき UserProfile 配列に変換される
- Supabase が error を返したら `DatabaseError` を throw する

### Header / page.tsx

- 既存の E2E (image-list.test.ts 等) で回帰検知。新規テストは追加しない (ロジック移行のみで挙動同一)
