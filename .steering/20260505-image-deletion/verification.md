# 検証ログ: 画像削除機能 (PRD P0 #2)

実施日: 2026-05-06

## 静的検証

### `biome check .`

```
Checked 65 files in 19ms. No fixes applied.
```

エラー 0 / 警告 0。

`biome.json` 変更点:
- `files.includes` に `!**/.claude/worktrees` を追加 (過去ワークツリーの biome.json と衝突回避)
- `css.parser.tailwindDirectives: true` を追加 (`@custom-variant` / `@theme inline` 認識)
- `overrides` に `components/ui/**` の lint / formatter / assist 全 disable を追加 (shadcn 出力の生成物方針差を許容)

### `tsc --noEmit`

```
tsc exit: 0
```

エラー 0。

## ユニットテスト

### `vitest run --coverage`

```
Test Files  13 passed (13)
     Tests  144 passed (144)
  Duration  1.17s
```

新規・拡張ケース:
- `tests/unit/repositories/image-repository.test.ts`: `softDelete` の 3 ケース追加 (成功 / 該当なし / DatabaseError)
- `tests/unit/services/image-service.test.ts`: `deleteImage` の 4 ケース追加 (NotFound / Forbidden / 成功 / TOCTOU)
- `tests/unit/api/images/delete-route.test.ts`: 新規ファイル、6 ケース (UUID 不正 / 未認証 / 成功 / NotFound / Forbidden / 想定外)

### カバレッジ (関連層のみ抜粋)

```
File                       | % Stmts | % Branch | % Funcs | % Lines
src/services/image-service | 100     | 96.96    | 100     | 100
src/repositories/image-rep | 100     | 92       | 100     | 100
```

既存閾値クリア。

## E2E テスト

### `playwright test`

```
Running 10 tests using 5 workers
10 passed (7.9s)
```

10 / 10 全 pass。

新規:
- `tests/e2e/image-deletion.test.ts`: 「未ログインで詳細を開いても削除トリガーが表示されない」(1 シナリオ)

## E2E カバレッジの限界 (記録)

設計時のシナリオ B (キャンセルでダイアログ閉じる) / シナリオ C (別ユーザーで削除トリガー非表示) は本 PR では追加していない。理由:

- 既存 E2E は全て未ログイン状態で動作しており、ログイン状態を作る基盤が無い
- GitHub OAuth を E2E でモックするには Supabase Local の auth スタブやテストユーザー injection の仕組みが必要
- 上記 2 シナリオはユニット層 (Service の `ForbiddenError`、Route Handler の 403、UI の `isOwner=false` で削除トリガー非表示) でカバー済み
- ログイン基盤の導入は「画像削除」とは独立した関心事のため、別 PR で実施するのが pr-principle に沿う

→ 改善提案として「実装後の振り返り > 次回への改善提案」に記載済み。

## 実装検証エージェントの指摘と対応

`implementation-validator` の指摘:

1. **[FAIL] `page.tsx` の `getImage` と `getUser` が直列実行**
   → 修正済み。`Promise.all` で並列化し LCP を維持する形に書き換え。`getImage` のエラーは `.catch()` で `null` に変換し、その後 `notFound()` に倒す既存方針を保持。

2. **[FAIL] E2E カバレッジ不足 (シナリオ B / C)**
   → 上記「E2E カバレッジの限界」のとおり、ログイン基盤は別 PR とする方針で確定 (ユーザー承認済み)。

3. **[要確認] `npm run lint` の npx エラー**
   → 環境依存 (RTK proxy の挙動) で実害なし。`./node_modules/.bin/biome lint .` は正常終了。CI では `node_modules` 配下の biome バイナリが直接呼ばれるため問題は発生しない想定。
