# 設計: 画像登録フォーム UI

## 全体像

```
[Header (Server)]                           [/images/new (Server)]
   ├─ 「画像を登録する」 link  ─────────►        ├─ getUser() で認証チェック
   │   (ログイン済みのみ)                         ├─ 未ログイン → redirect('/?auth_error=login_required')
   │                                             └─ <ImageRegisterForm /> (Client) を描画
   │
   └─ 既存の avatar / signOut / signIn は変更なし

[ImageRegisterForm (Client)]
   ├─ useState で imageUrl / status / errorMessage / existingImageId を管理
   ├─ Submit 時:
   │   1. createImageRequestSchema.safeParse() でクライアント側バリデーション
   │   2. fetch('/api/images', { method: 'POST', body: JSON.stringify({ imageUrl }) })
   │   3. レスポンス JSON を success / error スキーマで parse
   │   4. ok → router.refresh() + router.push('/')   (一覧再取得)
   │   5. ng → status code に応じて mapCreateImageError() でメッセージ整形
   │
   └─ disabled / aria-busy / data-testid を整備して E2E しやすくする
```

## ファイル構成

| ファイル | 役割 | 種別 |
|---------|------|------|
| `app/(site)/images/new/page.tsx` | 登録フォームページ (auth check + form 描画) | Server Component (新規) |
| `components/image-register-form.tsx` | URL 入力 + 送信 + エラー表示 | Client Component (新規) |
| `components/header.tsx` | 「画像を登録する」リンクを追加 | Server Component (修正) |
| `src/lib/validation/image.ts` | `createImageResponseSchema` / `createImageErrorResponseSchema` を追加 | 修正 |
| `src/lib/validation/create-image-error.ts` | API エラーレスポンスを UI メッセージに変換する純関数 `mapCreateImageError` | 新規 |
| `tests/unit/lib/validation/image.test.ts` | レスポンススキーマのテストを追加 | 修正 |
| `tests/unit/lib/validation/create-image-error.test.ts` | `mapCreateImageError` のテスト | 新規 |
| `tests/e2e/image-register.test.ts` | 未ログインリダイレクト + ヘッダーリンク可視性 | 新規 |

> **配置の判断**: エラーマッピング関数は `validation/` の責務 (zod 検証) と微妙にズレるが、API ↔ UI の入出力境界に位置する純粋関数のため、検証スキーマと同じ `src/lib/validation/` に隣接配置する。`development-guidelines.md` の「`src/lib/` は技術ユーティリティ集」の方針内に収まる。

## API レスポンス契約 (確認)

`app/api/images/route.ts` の挙動:

| 結果 | status | body |
|------|--------|------|
| 成功 | 201 | `{ id: string, imageUrl: string }` |
| 入力不正 / フォーマット不可 / サイズ超過 | 400 | `{ error: string }` |
| 未ログイン | 401 | `{ error: '認証が必要です' }` |
| 重複 | 409 | `{ error: string, existingImageId: string }` |
| 上限超過 | 429 | `{ error: '本日の登録上限(10枚)に達しました' }` |
| 内部エラー | 500 | `{ error: 'サーバーエラーが発生しました' }` |

スキーマ:

```ts
// 成功
export const createImageResponseSchema = z.object({
  id: z.string().min(1),
  imageUrl: z.string().url(),
});

// エラー (409 のみ existingImageId が付く)
export const createImageErrorResponseSchema = z.object({
  error: z.string().min(1),
  existingImageId: z.string().min(1).optional(),
});
```

## エラーメッセージマッピング

`mapCreateImageError(status: number, body: unknown): { message: string; existingImageId?: string }` の純関数。

```
400 → 「入力値が正しくありません${body.error ? `: ${body.error}` : ''}」
401 → 「セッションが切れました。再度ログインしてからお試しください」
409 → 「同じ画像がすでに登録されています」 + existingImageId
429 → 「本日の登録上限(10枚)に達しました。明日再度お試しください」
500/その他 → 「画像の登録に失敗しました。時間をおいて再度お試しください」
```

`createImageErrorResponseSchema.safeParse(body)` で zod 検証して、失敗時は 500 系の汎用メッセージにフォールバックする。`as` キャストは使わない。

## Server Component (`/images/new`)

```ts
export default async function NewImagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/?auth_error=login_required');
  }
  return (
    <section ...>
      <h1>LGTM 画像を登録する</h1>
      <p className="text-sm text-gray-600">画像 URL を入力すると、自動で LGTM 文字を合成して登録します。</p>
      <ImageRegisterForm />
      <Link href="/">キャンセル</Link>
    </section>
  );
}
```

- `redirect()` は Server Component から呼べる Next.js 標準 API
- 未ログイン経路はミドルウェアで弾かず、ページ側で redirect する (既存の `app/(site)/page.tsx` と同じく Server Component で `getUser()` する方針)

## Client Component (`ImageRegisterForm`)

状態:

- `imageUrl: string`
- `status: 'idle' | 'submitting' | 'error'`
- `errorMessage: string | null`
- `existingImageId: string | null`

submit 時:

1. `createImageRequestSchema.safeParse({ imageUrl: trimmed })`
2. パース失敗 → `setErrorMessage(parsed.error.issues[0]?.message ?? '入力値が不正です')` で終わる
3. パース成功 → `setStatus('submitting')` → fetch → response 解析
4. 201: `await res.json()` を `createImageResponseSchema` で parse → `router.refresh()` + `router.push('/')`
5. それ以外: `mapCreateImageError(res.status, await res.json().catch(() => null))` でメッセージ作成
6. fetch 自体が reject → 500 と同じメッセージ
7. `finally` で `setStatus('idle' | 'error')`

UX:

- 送信ボタンの `disabled = status === 'submitting'`、ラベル切り替え
- エラー表示は `<p role="alert" data-testid="image-register-error">` で aria に乗せる
- 入力欄の `data-testid="image-register-input"`、フォームの `data-testid="image-register-form"`
- 401 の場合は「再度ログインする」テキストリンク (`/?auth_error=login_required` へ。クリック後にトップで `signInWithGithub` ボタンを再表示)。Server Action を Form 内に二重配置するより遷移ベースで揃える方がシンプル

## ヘッダー修正

```tsx
{profile ? (
  <form action={signOut} className="flex items-center gap-3">
    <Link href="/images/new" className="text-sm text-gray-600 hover:text-gray-900">画像を登録する</Link>
    {/* avatar, name, signOut button */}
  </form>
) : (
  <form action={signInWithGithub}>...</form>
)}
```

`<form>` 内に `<Link>` を置いてもフォーム送信には影響しない (a 要素扱い)。視覚的な並びは `flex gap-3` のまま。`signOut` ボタンは末尾。

## 既存ページへの追加要素 (任意)

- `app/(site)/page.tsx` のログイン済み状態に「画像を登録する」ボタンを追加することも検討したが、ヘッダー導線が常時可視のため二重配置は避ける。今回はヘッダーのみで十分とする。

## テスト戦略

### ユニット (Vitest)

1. `createImageResponseSchema`: 正しい形 / id 欠損 / imageUrl が URL でない
2. `createImageErrorResponseSchema`: error のみ / error + existingImageId / error 欠損
3. `mapCreateImageError`:
   - 400 (body あり / なし)
   - 401
   - 409 (existingImageId あり)
   - 429
   - 500
   - 想定外 status
   - body が `null` / 不正な JSON だったケース

### E2E (Playwright, Supabase 接続なしで成立する範囲)

1. **未ログイン redirect**: `/images/new` に直接遷移すると `/` に飛ばされ、`auth_error=login_required` クエリが付く
2. **ヘッダーの登録リンクは未ログイン時に非表示**: `/` で「画像を登録する」リンクが見えない

> ログイン済みでの送信成功・409・429 などは Supabase Local + 実セッションが必要なため、本作業ではユニット/手動確認に委ね、後続の統合テスト基盤整備で追加する (前作業 `20260504-image-list-screen` の振り返りで挙がっている方針と同じ)。

## 影響範囲・リスク

| 観点 | 影響 |
|------|------|
| 既存 API | 変更なし (UI から呼ぶだけ) |
| 既存ページ | `app/(site)/page.tsx` は変更なし。`Header` のレイアウトに 1 リンク追加のみ |
| RLS / 認証 | 既存の `signInWithGithub` / `createClient` パターンに揃えるためリスク低 |
| Cache 戦略 | 登録成功後は `router.refresh()` で `/` の Server Component を再評価する。Next.js App Router の標準挙動 |
| バンドル増 | Client Component 1 つの増加 (~3KB 想定)。LCP への影響は登録ページ専用なので無視できる |

## ロールアウト

- ヘッダー導線追加 + 新ページ追加 + フォーム + テストを 1 PR にまとめる (≦ 300 行プロダクションコードを目標)
- マージ後の動作確認は `verification.md` に手順を残す (本ステアリングディレクトリ内に追加)
