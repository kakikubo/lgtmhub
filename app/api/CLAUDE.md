# app/api/ Route Handler 規約

Route Handler の責務は認証チェック・zod バリデーション・service 呼び出し・エラー変換のみ。
ビジネスロジックや supabase クエリはここに書かず、`buildXxxService(supabase)` ファクトリ経由で
service を呼ぶ。参照: app/api/images/route.ts

誤認されやすいが正しいパターン:

- zod スキーマは route 内にインラインで書かず src/lib/validation/{ドメイン}.ts に置く。
  レスポンス側のスキーマも定義する。クライアントが fetch 結果を safeParse して
  型ズレを実行時検出するため。参照: src/lib/validation/image.ts
- エラー変換は catch で instanceof を具体サブクラス → AppError の順に並べる
  (DuplicateImageError→409, DailyLimitExceededError→429, NotFoundError→404,
  UnauthorizedError→401, ForbiddenError→403, BadRequestError→400, AppError→500)。
  error.code 文字列では分岐しない
- 'use cache' + cacheTag されたデータを変更する route は revalidateTag を呼ぶ。
  呼び忘れるとトップの一覧が古いまま残る。参照: src/lib/cache/list-home-images.ts
- cacheComponents 有効下で動的であるべき route は先頭で connection() を呼んで
  prerender を抑止する。参照: app/api/images/random/route.ts
