-- Supabase Local 用シードデータ
-- マイグレーション後に `supabase db reset` (および初回の `supabase start`) で適用される
--
-- ここで投入するのは e2e / ローカル開発が前提にする「決定的なフィクスチャ」(Issue #279)。
-- e2e テストは以前、画像 0 件のときに実行時 test.skip() で緑になっていた (サイレント no-op)。
-- CI は `supabase start` → `pnpm run build` → Playwright の順に動くため、ビルドより前に
-- データが存在するこの seed.sql で入れる必要がある (トップページ一覧は 'use cache' +
-- cacheLife('max') でキャッシュされ、ビルド後の INSERT が反映されない恐れがあるため)。
--
-- TypeScript 側の対応する定数: tests/e2e/fixtures/seed-images.ts

-- 再実行できるよう先に落とす (user_profiles / lgtm_images は cascade で消える)
delete from auth.users where id = '5eed0000-0000-4000-8000-000000000000';

-- 投稿者。e2e の globalSetup が毎回作り直すテストユーザー (e2e-user@example.com) とは
-- 別人にして、テストユーザー削除の cascade でフィクスチャが巻き添えにならないようにする。
-- public.user_profiles はマイグレーション済みトリガー handle_new_user() が
-- raw_user_meta_data から自動生成する (本番の GitHub OAuth と同じ経路)。
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  -- GoTrue はこれらを非 NULL の文字列として読むため、DEFAULT の無い列は '' で埋める。
  -- NULL のままだと admin API (listUsers など) が
  -- "Database error finding users" で落ちる
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change
) values (
  '00000000-0000-0000-0000-000000000000',
  '5eed0000-0000-4000-8000-000000000000',
  'authenticated',
  'authenticated',
  'seed-uploader@example.com',
  -- このユーザーでサインインする経路は無いのでログイン不可のダミー値でよい。
  -- pgcrypto (crypt/gen_salt) の search_path 依存を避けるため bcrypt 形式のリテラルを置く
  '$2a$10$e2eseeduploadernosigninpath0123456789abcdefghijklmnop',
  '2026-01-05 00:00:00+00',
  '{"provider": "github", "providers": ["github"]}'::jsonb,
  jsonb_build_object(
    'user_name', 'lgtmhub-seed',
    'full_name', 'LGTMHub Seed Uploader',
    'avatar_url', '/default-avatar.svg'
  ),
  '2026-01-05 00:00:00+00',
  '2026-01-05 00:00:00+00',
  '',
  '',
  '',
  ''
);

-- LGTM 画像フィクスチャ 5 件。
-- * created_at を 1 秒ずつずらし、一覧の `created_at desc` 順序を一意に決める
--   (fixture-1 が最新 = 先頭カード)
-- * image_url は public/default-avatar.svg を指す相対パス。外部ネットワークに依存せず、
--   next/image は dangerouslyAllowSVG 未設定のとき `.svg` を自動的に unoptimized 扱いする
--   ため Image Optimizer の 400 を踏まない。拡張子判定はクエリを無視するので
--   `?fixture=N` を付けて 5 件を別 URL にできる
-- * 件数 5 は components/image-grid.tsx の PRIORITY_IMAGE_COUNT = 4 より 1 件多い。
--   「先頭 4 枚は priority / 5 枚目は lazy」のコントラストを e2e で検証するため
insert into public.lgtm_images (
  id,
  uploader_id,
  original_url,
  image_url,
  p_hash,
  width,
  height,
  file_size_bytes,
  mime_type,
  is_animated,
  status,
  created_at,
  updated_at
)
select
  ('5eed0000-0000-4000-8000-0000000' || lpad(n::text, 5, '0'))::uuid,
  '5eed0000-0000-4000-8000-000000000000',
  'https://example.com/lgtmhub-seed-' || n || '.png',
  '/default-avatar.svg?fixture=' || n,
  -- p_hash は POST /api/images の重複判定 (hammingDistance) で必ず比較対象になるため、
  -- 長さを src/lib/image/calculate-phash.ts の PHASH_LENGTH (32*32=1024) と一致させ、
  -- 0/1 のみで構成する。長さが違うと hammingDistance が throw し登録 API が 500 になる。
  -- 単色画像の pHash は全ビット '1' (value >= avg) になるので、'1' の繰り返しは使わない
  -- (DUPLICATE_THRESHOLD=10 以内に収まり 409 の誤爆を招く)。
  -- 0/1 交互パターンを n だけずらし、フィクスチャ同士も実画像とも十分離す
  left(repeat('0', n) || repeat('01', 512), 1024),
  266,
  199,
  1024 * n,
  'image/webp',
  false,
  'active',
  timestamptz '2026-01-05 00:00:00+00' - make_interval(secs => n),
  timestamptz '2026-01-05 00:00:00+00' - make_interval(secs => n)
from generate_series(1, 5) as n;
