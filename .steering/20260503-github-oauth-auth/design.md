# 設計: GitHub OAuth 認証

## 全体方針

- Supabase Auth の **GitHub OAuth プロバイダ**にログイン責務を委譲する。アプリ側は「OAuth フローの開始」と「コールバックでのセッション確立」だけを実装する
- ユーザープロフィールは **DB トリガ** で `auth.users` の INSERT を契機に `user_profiles` を初回作成する。アプリ側 Service による同期は本フェーズではやらない（追記同期は後続機能の必要が出たタイミングで再評価）
- セッションのリフレッシュは **`middleware.ts`** で `supabase.auth.getUser()` を呼び、戻りの cookie を `NextResponse` に伝播させる Supabase 公式パターンを採用
- 認証 UI は **Server Action**（`'use server'`）から `supabase.auth.signInWithOAuth` を呼び、得られた authorize URL に `redirect()` する。Server Component から呼び出す `<form action={signInWithGithub}>` で実装

---

## アーキテクチャ上の位置付け

```
Presentation (components/header.tsx, app/(site)/layout.tsx, page.tsx)
   ↓ form action
Server Action (src/lib/auth/actions.ts)
   ↓
Supabase Auth (signInWithOAuth / signOut)
   ↓ ブラウザ → GitHub → /api/auth/callback
API Route (app/api/auth/callback/route.ts)
   ↓ exchangeCodeForSession
Supabase Auth → auth.users INSERT
   ↓ trigger
Data Layer (public.user_profiles)
```

- Server Action は `src/lib/auth/` 配下に置く（`src/services/` ではない: ビジネスロジックではなく Supabase Auth への薄いラッパー）
- リポジトリ単位での読み取り（後続機能でのプロフィール表示等）は `src/repositories/user-profile-repository.ts` から提供

---

## DB スキーマ

### マイグレーション: `supabase/migrations/20260503000000_create_user_profiles.sql`

```sql
-- 1. テーブル
create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_login text not null unique,
  display_name text not null,
  avatar_url text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_profiles_github_login_idx on public.user_profiles (github_login);

-- 2. updated_at 自動更新
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- 3. auth.users INSERT トリガ → user_profiles 初回作成
--    GitHub OAuth でサインアップした場合のみ raw_user_meta_data に `user_name` がある
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_github_login text;
  v_display_name text;
  v_avatar_url   text;
begin
  v_github_login := new.raw_user_meta_data ->> 'user_name';
  v_display_name := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'name',
    v_github_login
  );
  v_avatar_url := coalesce(new.raw_user_meta_data ->> 'avatar_url', '');

  if v_github_login is null then
    -- GitHub 以外のプロバイダでサインアップした場合は何もしない（MVP では到達しない）
    return new;
  end if;

  insert into public.user_profiles (id, github_login, display_name, avatar_url)
  values (new.id, v_github_login, v_display_name, v_avatar_url)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RLS
alter table public.user_profiles enable row level security;

create policy "anyone can view user_profiles"
  on public.user_profiles
  for select
  using (true);

create policy "users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = id);

create policy "users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
```

### 設計上のポイント

- **トリガ方式**: アプリ層から profile を作るより RLS / レース耐性の観点で安全。`security definer` で `auth.users` 側の権限から `public.user_profiles` に書き込む
- **`on conflict (id) do nothing`**: 万一二重発火しても落ちない（Supabase 内部で再発火するエッジケースに備える）
- **`updated_at` トリガ**: 後続でプロフィール更新機能が入った際に追加実装不要
- **`anyone can view user_profiles`**: 画像一覧で表示名 / アバターを将来表示する想定（PRD では MVP の一覧 UI に投稿者は出さないが、API 経由で取得できる状態は許容する）

---

## 型定義

### `src/types/user.ts`

```ts
export interface UserProfile {
  id: string;
  githubLogin: string;
  displayName: string;
  avatarUrl: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### `src/types/database.types.ts`

`npm run db:types`（=`supabase gen types typescript --local`）で自動生成する。生成のためには `supabase start` → `supabase db reset` が必要。Docker が動いていない環境では生成できないため、本フェーズでは **必要最小限の型を手書き**してコミットし、`npm run db:types` を将来的に再実行することで上書きされる想定とする（過去 commit の方針と整合）。

手書き内容（最小スコープ）:

```ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          github_login: string;
          display_name: string;
          avatar_url: string;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          github_login: string;
          display_name: string;
          avatar_url: string;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          github_login: string;
          display_name: string;
          avatar_url: string;
          is_admin: boolean;
          updated_at: string;
        }>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
```

> 自動生成の出力と完全一致しなくても、`Database['public']['Tables']['user_profiles']['Row']` を参照するアプリコードがコンパイル可能であればよい。

---

## エラークラス追加

`src/lib/errors.ts`:

```ts
export class UnauthorizedError extends AppError {
  constructor(message = '認証が必要です') {
    super(message, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'この操作を実行する権限がありません') {
    super(message, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}
```

`tests/unit/lib/errors.test.ts` にケースを 2 件追加する。

---

## ミドルウェア設計

`middleware.ts`（プロジェクトルート）:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- `getUser()` は session refresh の副作用として cookies を更新するため、戻り値は使わない
- matcher で静的アセットを除外し、middleware の負荷を抑える

---

## Server Action 設計

`src/lib/auth/actions.ts`:

```ts
'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/src/lib/supabase/server';

export async function signInWithGithub() {
  const supabase = await createClient();
  const headerList = await headers();
  // origin 取得: Vercel preview / 本番 / ローカルすべてに対応
  const origin =
    headerList.get('origin') ??
    `${headerList.get('x-forwarded-proto') ?? 'http'}://${headerList.get('host') ?? 'localhost:3000'}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  });

  if (error || !data.url) {
    redirect('/?auth_error=signin_failed');
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/');
}
```

- Server Action は `<form action={signInWithGithub}>` で呼び出す（Client Component 不要）
- `redirect()` は throw するため return 不要

---

## OAuth コールバック

`app/api/auth/callback/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(new URL('/?auth_error=missing_code', request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL('/?auth_error=exchange_failed', request.url));
  }

  return NextResponse.redirect(new URL(next, request.url));
}
```

- `repository-structure.md` の「Service Layer 経由の例外」として既に明記されているため、本ルートは Service を経由せず `src/lib/supabase/server.ts` を直接利用してよい

---

## ユーザープロフィール Repository

`src/repositories/user-profile-repository.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { DatabaseError, NotFoundError } from '@/src/lib/errors';
import type { Database } from '@/src/types/database.types';
import type { UserProfile } from '@/src/types/user';

type Row = Database['public']['Tables']['user_profiles']['Row'];

function toUserProfile(row: Row): UserProfile {
  return {
    id: row.id,
    githubLogin: row.github_login,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isAdmin: row.is_admin,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class UserProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findById(id: string): Promise<UserProfile | null> {
    const { data, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new DatabaseError(error.message);
    if (!data) return null;
    return toUserProfile(data);
  }

  async findByIdOrThrow(id: string): Promise<UserProfile> {
    const profile = await this.findById(id);
    if (!profile) throw new NotFoundError('UserProfile', id);
    return profile;
  }
}
```

- `as` キャスト不使用（`Database` ジェネリクスで Supabase Client 側の型推論に任せる）
- `maybeSingle()` で 0 件を `null` として扱い、利用側に任せる

---

## UI 設計

### `components/header.tsx`

サーバーコンポーネント。`createClient()` で `auth.getUser()` を呼び、未ログイン / ログイン済みで分岐表示。

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { signInWithGithub, signOut } from '@/src/lib/auth/actions';
import { createClient } from '@/src/lib/supabase/server';
import { UserProfileRepository } from '@/src/repositories/user-profile-repository';

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const repo = new UserProfileRepository(supabase);
    profile = await repo.findById(user.id);
  }

  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold">
          LGTMHub
        </Link>
        <div>
          {profile ? (
            <form action={signOut} className="flex items-center gap-3">
              {profile.avatarUrl ? (
                <Image
                  src={profile.avatarUrl}
                  alt={profile.displayName}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              ) : null}
              <span className="text-sm">{profile.displayName}</span>
              <button
                type="submit"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                ログアウト
              </button>
            </form>
          ) : (
            <form action={signInWithGithub}>
              <button
                type="submit"
                className="text-sm bg-gray-900 text-white px-3 py-1.5 rounded hover:bg-gray-700"
              >
                GitHub でログイン
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
```

### `app/(site)/layout.tsx`

`<Header />` を組み込む。

### `app/(site)/page.tsx`

- 未ログイン: 「ログインして登録」ボタン（Server Action）
- ログイン済: 「ようこそ {displayName} さん」+ プレースホルダ

### `next.config.ts`

GitHub アバターを `next/image` で表示するため `avatars.githubusercontent.com` を `images.remotePatterns` に追加する。

---

## Supabase Local 設定

`supabase/config.toml` に追記:

```toml
[auth.external.github]
enabled = true
client_id = "env(GITHUB_OAUTH_CLIENT_ID)"
secret = "env(GITHUB_OAUTH_CLIENT_SECRET)"
redirect_uri = ""
```

- `redirect_uri` は空にして Supabase がデフォルト（`http://localhost:54321/auth/v1/callback`）を採用するに任せる
- `env()` 参照により `.env.local` に値があれば動く・無ければ disabled として動く

---

## テスト戦略

### Unit (Vitest)

| ファイル | 内容 |
|---------|------|
| `tests/unit/lib/errors.test.ts` | `UnauthorizedError` / `ForbiddenError` の `code` / `message` / `instanceof` |
| `tests/unit/repositories/user-profile-repository.test.ts` | `findById` の `null` 返却 / 正常返却 / `error` 時の `DatabaseError` throw / `findByIdOrThrow` の `NotFoundError` throw |
| `tests/unit/lib/auth/actions.test.ts` | `signInWithGithub` が `redirect(data.url)` を呼び、エラー時は `auth_error=...` に redirect / `signOut` が `signOut()` 後に `/` に redirect |

Supabase Client は `vi.fn()` で必要メソッドのみモック。

### Integration

OAuth フロー全体は本物の GitHub への遷移を伴うため、CI ではカバーしない。本フェーズでは作成しない。

### E2E (Playwright)

`tests/e2e/auth.test.ts`:
- 未ログインでトップを開くと「GitHub でログイン」ボタンが表示される
- ヘッダーに「LGTMHub」ロゴが表示される
- 既存の `tests/e2e/smoke.test.ts` を新トップページの内容に合わせて更新（`scaffolding 完了` 文言が消えるため）

実際の OAuth リダイレクトはテスト対象外。

---

## ドキュメント更新

| ファイル | 内容 |
|---------|------|
| `docs/glossary.md` | エラー一覧に `UnauthorizedError` / `ForbiddenError` を追記 / 索引にも追加 |
| `docs/repository-structure.md` | プロジェクト構造ツリーに `middleware.ts` と `src/lib/auth/actions.ts` を追記。例外 `app/api/auth/callback/route.ts` の説明と整合 |
| `docs/development-guidelines.md` | サンプル例の整合性チェック（必要な場合のみ修正） |
| `README.md` | GitHub OAuth App 登録手順 / Supabase に Client ID/Secret を渡す手順 |

---

## 想定リスクと対処

| リスク | 影響 | 対処 |
|--------|------|------|
| Docker が起動できず supabase ローカル DB を立ち上げられない | `npm run db:types` 実行不可 | `database.types.ts` を最小手書きでコミット。再生成は将来 user 環境で対応 |
| `noUncheckedIndexedAccess: true` で配列・JSON アクセスが `T \| undefined` になる | 型エラー | repository / trigger SQL 周辺で `?` / null チェックを徹底。`raw_user_meta_data ->> ...` は SQL 側で `coalesce()` |
| Server Action の `redirect()` が tests 内で throw されモック扱い困難 | unit test 失敗 | `next/navigation` の `redirect` を `vi.mock` でスタブし、呼び出し回数 / 引数を検証 |
| `next/image` の `remotePatterns` に GitHub avatars が無く画像表示エラー | UI 破綻 | `next.config.ts` に `avatars.githubusercontent.com` を追加 |
| `auth.users` メタデータの形が GitHub プロバイダ依存 | profile NULL | `coalesce(user_name, full_name, name)` で順に評価。null の場合は trigger 内で early return |
| middleware が静的アセットにも走り遅延 | TTFB 悪化 | matcher で静的拡張子と `_next/*` を除外 |
| Server Component が直接 Repository を経由する違和感 | アーキテクチャ準拠 | `repository-structure.md` の例外（OAuth コールバックは Service を経由しない）に準拠。Header の profile 取得もこの例外と同じ「単純 read のみ」のため許容（後続で Service 化検討） |

---

## 完了判定

- [ ] `npm run lint` 成功
- [ ] `npm run typecheck` 成功
- [ ] `npm test` 成功（既存 6 + 追加分）
- [ ] `npm run dev` でトップが 200・ヘッダーに「GitHub でログイン」ボタンが表示
- [ ] `supabase/migrations/20260503000000_create_user_profiles.sql` のスキーマレビュー OK
- [ ] PRD #3 受け入れ条件 5 項目すべてに該当する実装ファイル / 設定が存在
- [ ] `docs/glossary.md` / `docs/repository-structure.md` / `README.md` の追記完了
