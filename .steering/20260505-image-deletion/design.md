# 設計

## 全体方針

- **論理削除のみ** (`status='deleted'`, `deleted_at=now()`)。Vercel Blob 物理削除は P1 機能 8 で別 PR
- **多層防御**: Supabase RLS + アプリ層 (Service `findActiveById` で 404/403 を判別 + Repository `softDelete` の WHERE 句で本人一致を強制)
- **既存パターン踏襲**: Route Handler → Service → Repository の流れと、`createClient()` で SSR Supabase を使う既存パターンを踏襲
- **shadcn/ui 初期化**: AlertDialog 1 つのために最小限のセットアップを同梱。エイリアスは既存コードと揃え `@/src/lib/utils` を採用

## ステータスコードの設計

| 状況 | 返却値 |
|------|--------|
| 未ログイン | 401 |
| ID が UUID 形式でない | 400 |
| ID は形式 OK だが該当画像なし / `status='deleted'` | 404 |
| `uploader_id !== authUserId` | 403 |
| 論理削除成功 | 204 No Content |
| Supabase / 内部例外 | 500 |

`docs/functional-design.md` の表に準拠。

> 「他人のリソースは存在を漏らさず 404」とするセキュリティパターンもあるが、PRD・機能設計書ともに 403 を明記しているため 403 を採用する。

## レイヤー設計

```
┌─────────────────────────────────────────┐
│ Client                                  │
│   components/image-detail-actions.tsx   │
│   - AlertDialog (shadcn/ui)             │
│   - fetch DELETE /api/images/{id}       │
│   - useTransition / useRouter           │
└─────────────────────────────────────────┘
                  ↓ DELETE
┌─────────────────────────────────────────┐
│ Route Handler                           │
│   app/api/images/[id]/route.ts          │
│   - 認証チェック (auth.getUser)         │
│   - UUID バリデーション (zod)           │
│   - Service 呼び出し                    │
│   - エラーマッピング                    │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Service (src/services/image-service.ts) │
│   ImageService.deleteImage(id, userId)  │
│   1. findActiveById(id) → 無ければ 404  │
│   2. uploaderId !== userId → 403        │
│   3. softDelete(id, userId)             │
│      → 0 件なら NotFoundError (TOCTOU)  │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│ Repository                              │
│   ImageRepository.softDelete(id, userId)│
│   UPDATE lgtm_images                    │
│     SET status='deleted',               │
│         deleted_at=now()                │
│   WHERE id = ?                          │
│     AND uploader_id = ?                 │
│     AND status = 'active'               │
│   → 更新行数を返す (0 or 1)             │
└─────────────────────────────────────────┘
```

## 各層の詳細設計

### Repository: `ImageRepository.softDelete`

```ts
/**
 * 論理削除する。所有者・active 状態を WHERE 句で同時に強制し、
 * RLS と二重で「他人の画像」「既に削除済み」を弾く。
 *
 * @returns 更新された行数 (0 or 1)。0 = 該当なし (存在しない / 他人 / 既削除)
 */
async softDelete(id: string, userId: string): Promise<number> {
  const { data, error } = await this.supabase
    .from('lgtm_images')
    .update({ status: 'deleted', deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('uploader_id', userId)
    .eq('status', 'active')
    .select('id'); // 更新行数を取るため最低 1 列だけ select

  if (error) throw new DatabaseError(error.message);
  return (data ?? []).length;
}
```

**設計判断**:
- `deleted_at` はアプリ側で `new Date().toISOString()` を入れる (RLS 経由でも書き込めることを担保。DB の `default now()` は INSERT 時のみ作用するため `update` では明示が必要)
- `select('id')` で更新後の行を返してもらい、件数を `data.length` で取る (Supabase は UPDATE で `count` を別経路で取れるが、型推論上 `select()` を付けた方がシンプル)
- 戻り値を `number` にしたのは「Service 層で TOCTOU を判別したいから」。`boolean` でも良いが、将来的に bulk delete を考えると `number` の方が拡張容易

### Service: `ImageService.deleteImage`

```ts
/**
 * 画像を論理削除する。
 *
 * 順序の意図:
 *   1. findActiveById で先に 404 と 403 を判別する (UI に正確なエラー理由を返すため)
 *   2. softDelete は WHERE で本人 + active を強制 (RLS + アプリ二重防御)
 *   3. 万一 1 と 3 の間に他者が削除した場合 (TOCTOU) は 0 件になり NotFoundError に倒す
 *
 * @throws NotFoundError - 画像が存在しない / 既に削除済み
 * @throws ForbiddenError - uploader_id が requesterId と異なる
 */
async deleteImage(id: string, requesterId: string): Promise<void> {
  const image = await this.imageRepo.findActiveById(id);
  if (!image) {
    throw new NotFoundError('画像', id);
  }
  if (image.uploaderId !== requesterId) {
    throw new ForbiddenError();
  }

  const updated = await this.imageRepo.softDelete(id, requesterId);
  if (updated === 0) {
    // findActiveById と softDelete の間に削除されたレース。404 に倒す
    throw new NotFoundError('画像', id);
  }
}
```

**設計判断**:
- 既存 `findActiveById` を再利用 (PR #25 で導入済み)
- 管理者削除 (機能 6 / P1) の分岐は本 PR では入れない。本人削除に限定し、管理者ロジックは別 PR で追加することをコメントで残す
- Blob 物理削除は呼ばない (P1 機能 8 で日次ジョブが行う)

### Route Handler: `app/api/images/[id]/route.ts`

```ts
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@/src/lib/errors';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolved = await params;
  const parsed = paramsSchema.safeParse(resolved);
  if (!parsed.success) {
    return NextResponse.json({ error: '画像 ID が不正です' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const service = buildImageService(supabase);
    await service.deleteImage(parsed.data.id, user.id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ error: '画像が見つかりません' }, { status: 404 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: '削除する権限がありません' }, { status: 403 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err instanceof AppError) {
      console.error('[DELETE /api/images/[id]] AppError', err);
      return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
    }
    console.error('[DELETE /api/images/[id]]', err);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
```

**設計判断**:
- POST と同じエラーマッピングのパターンを踏襲
- `paramsSchema` で UUID 検証 (DB クエリへ不正値が流れない)
- 既存 `app/api/images/route.ts` の隣に `[id]/route.ts` を新設 (機能設計書の予約パスと一致)

### UI: 画像詳細ページの所有者判定

```tsx
// app/(site)/images/[id]/page.tsx
export default async function ImageDetailPage({ params }: ImageDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: { user } }, image] = await Promise.all([
    supabase.auth.getUser(),
    buildImageService(supabase).getImage(id).catch(() => null),
  ]);

  if (!image) notFound();

  const isOwner = !!user && user.id === image.uploaderId;

  return <DetailView image={image} isOwner={isOwner} />;
}
```

**設計判断**:
- `getUser()` と `getImage()` を `Promise.all` で並列化 (LCP 維持)
- 認証取得は `auth.getUser()` で改ざん耐性のあるユーザー情報を取得 (`getSession()` ではなく)
- `isOwner` のみクライアント Component に渡す。`user.id` などの認証情報は流さない

### UI: 削除アクション (新規 Client Component)

```tsx
// components/image-detail-actions.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function ImageDetailActions({ imageId }: { imageId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
      if (res.status === 204) {
        setOpen(false);
        router.refresh(); // 一覧 Server Component キャッシュ破棄
        router.push('/');
        return;
      }
      const json = await res.json().catch(() => null);
      const message =
        (json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
          ? json.error
          : null) ?? '削除に失敗しました';
      setError(message);
    });
  };

  return (
    <div className="space-y-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          data-testid="image-delete-trigger"
          className="text-sm text-red-600 hover:text-red-800 underline"
        >
          画像を削除
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="image-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>この画像を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              削除後は一覧・お気に入りから表示されなくなります。この操作は取り消せません。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              data-testid="image-delete-confirm"
              disabled={pending}
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              {pending ? '削除中…' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" data-testid="image-delete-error" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
```

**設計判断**:
- `useTransition` で 削除中は二重クリック防止
- 成功時 `router.refresh()` → `router.push('/')` の順 (登録フォームと同パターン)
- エラーは画面内表示。toast ライブラリは導入しない (シンプル化)
- `AlertDialog` は uncontrolled な `Trigger` だと「削除実行中もダイアログを閉じない」制御が難しいため `open` を制御化

## shadcn/ui 初期化方針

### `components.json` の設定

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/src/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/src/lib",
    "hooks": "@/src/lib/hooks"
  },
  "iconLibrary": "lucide"
}
```

**設計判断**:
- `tailwind.config` は v4 では空。`globals.css` ベースの `@theme` に統一される
- `aliases.utils` は `@/src/lib/utils` (既存コードの import 規約 `@/src/lib/...` と整合)
- `style: new-york` (デフォルト)

### 追加される依存

`npx shadcn@latest add alert-dialog` 実行で次が追加される想定:
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-slot` (Button 派生で使う)
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react`
- `tw-animate-css` (v4 のアニメーション)

### `app/globals.css` の差分

shadcn init は CSS 変数 (light/dark) と `@theme inline` ブロックを `globals.css` に追記する。既存の `--background` / `--foreground` を上書きする可能性があるため、init 後に手動マージする必要がある。

## テスト方針

### ユニット (Vitest)

| 対象 | テストケース |
|------|-------------|
| `ImageRepository.softDelete` | 1 件成功で 1 を返す / 該当 0 件で 0 を返す / Supabase エラーで `DatabaseError` を throw |
| `ImageService.deleteImage` | 存在しない → `NotFoundError` / 他人 → `ForbiddenError` / 成功 → resolve / softDelete が 0 を返す → `NotFoundError` (TOCTOU) |
| `app/api/images/[id]/route.ts` DELETE | 401 (未ログイン) / 400 (UUID 不正) / 404 / 403 / 204 / 500 |

### E2E (Playwright)

`tests/e2e/image-deletion.test.ts` を新設:
- (前提) Supabase Local + シードユーザーを使う既存パターン
- 自分の画像詳細を開く → 削除トリガー → ダイアログ → 削除 → `/` に戻り、当該画像が一覧に無い
- キャンセルではダイアログが閉じ、画像は残る
- 他人の画像詳細では削除トリガーが表示されない
- 未ログインでは削除トリガーが表示されない

### 既存テストの影響確認

- `tests/unit/services/image-service.test.ts`: 既存ケースは変更なし、`deleteImage` の 4 ケース追加
- `tests/unit/repositories/image-repository.test.ts`: `softDelete` の 3 ケース追加
- `tests/e2e/image-detail.test.ts`: 既存テストは未認証で開く前提。所有者チェックの追加で削除トリガーが「表示されない」検証を追加

## 既存実装への影響

| ファイル | 影響 |
|----------|------|
| `app/(site)/images/[id]/page.tsx` | `getUser()` を追加し `isOwner` 判定 → `<ImageDetailActions>` を埋め込む |
| `src/services/image-service.ts` | `deleteImage` メソッド追加 |
| `src/repositories/image-repository.ts` | `softDelete` メソッド追加 |
| `app/globals.css` | shadcn init による CSS 変数追記 (既存の `--background`/`--foreground` をマージ) |
| `package.json` | shadcn 関連依存の追加 |
| `tsconfig.json` | 変更なし (paths は既存で OK) |

## 想定される失敗パターンと対処

| 失敗 | 対処 |
|------|------|
| shadcn init が `app/globals.css` の既存 CSS 変数を破壊 | init 直後に diff を確認し、既存変数を残しつつ shadcn の変数を追加 |
| Tailwind v4 と shadcn テンプレが整合しない | shadcn の Tailwind v4 対応版を使う。問題が出たら `prefers-color-scheme` メディアクエリのみ手動で残す |
| `getUser()` 追加で詳細ページの LCP が悪化 | `Promise.all` で並列化済み。LCP は引き続き 2 秒以内目標 |
| 認証 cookie 無しの未ログイン環境で DELETE → 401 | `auth.getUser()` で user が null なら 401 を返す既存パターンで吸収 |
| RLS の UPDATE ポリシーが本人 or 管理者のため、本 PR では本人専用に絞り切れない | アプリ層 `softDelete` の WHERE で `uploader_id = userId` を強制。RLS は上位互換で OK |

## 参照

- `docs/architecture.md` - レイヤー境界
- `docs/functional-design.md` - 削除フロー / API 仕様 / セキュリティ
- `docs/repository-structure.md` - `app/api/images/[id]/route.ts` 予約パス / `components/ui/` 配置
- `supabase/migrations/20260504000000_create_lgtm_images.sql` - 既存 RLS
- `app/(site)/images/[id]/page.tsx` - PR #25 のベース実装
- `app/api/images/route.ts` - エラーマッピング規約
- `components/image-register-form.tsx` - クライアント fetch + router の参考
