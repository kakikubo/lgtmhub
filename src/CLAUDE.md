# src/ 規約

誤認されやすいが正しいパターン:

- Supabase クライアントは2種類あり互換ではない。createClient() (src/lib/supabase/server.ts)
  は cookies() 依存で認証つき、createAnonClient() (src/lib/supabase/anon.ts) はセッション
  なしの匿名読み取り用。'use cache' 関数の中では cookies() が呼べないため必ず
  createAnonClient() を使う。参照: src/lib/cache/list-home-images.ts
- エラーは src/lib/errors.ts の AppError サブクラスを throw する。HTTP ステータスへの
  変換は app/api 層だけが行い、service/repository は NextResponse を知らない
- スキーマ変更後は `pnpm run db:types` で src/types/database.types.ts を再生成して
  同じコミットに含める (自動生成だがコミット対象)
