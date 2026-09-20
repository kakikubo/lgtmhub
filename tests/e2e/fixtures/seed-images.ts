// supabase/seed.sql が投入する決定的なフィクスチャの TypeScript 側定義 (Issue #279)。
//
// e2e はこのデータが存在することを前提に、条件付き test.skip() を使わず無条件にアサートする。
// SQL 側との二重管理になるが、ズレた場合は e2e の失敗として現れる (自動生成はしない)。
// 投入タイミングは `supabase start` / `supabase db reset`。

/** seed.sql が作る投稿者 (e2e の globalSetup が作るテストユーザーとは別人) */
export const SEED_UPLOADER = {
  githubLogin: 'lgtmhub-seed',
  displayName: 'LGTMHub Seed Uploader',
  profileUrl: 'https://github.com/lgtmhub-seed',
} as const;

/**
 * 一覧の表示順 (created_at desc) と同じ並び。シードだけが入っている CI では
 * 先頭 = トップページの先頭カードになる (ローカルで画像を登録していると後方へずれるため、
 * テスト側は「先頭カード」か「ID 直リンク」のどちらかで位置に依存しないように書く)。
 * components/image-grid.tsx の PRIORITY_IMAGE_COUNT = 4 に対し 1 件多い 5 件を用意し、
 * 「先頭 4 枚は priority / 5 枚目は lazy」を検証できるようにしている。
 */
export const SEED_IMAGES = [
  { id: '5eed0000-0000-4000-8000-000000000001', imageUrl: '/default-avatar.svg?fixture=1' },
  { id: '5eed0000-0000-4000-8000-000000000002', imageUrl: '/default-avatar.svg?fixture=2' },
  { id: '5eed0000-0000-4000-8000-000000000003', imageUrl: '/default-avatar.svg?fixture=3' },
  { id: '5eed0000-0000-4000-8000-000000000004', imageUrl: '/default-avatar.svg?fixture=4' },
  { id: '5eed0000-0000-4000-8000-000000000005', imageUrl: '/default-avatar.svg?fixture=5' },
] as const;

export const SEED_IMAGE_COUNT = SEED_IMAGES.length;

/** components/image-grid.tsx の PRIORITY_IMAGE_COUNT と同じ値 (変更時は両方直す) */
export const PRIORITY_IMAGE_COUNT = 4;
