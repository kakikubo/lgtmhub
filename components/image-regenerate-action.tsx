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
import { regenerateImageResponseSchema } from '@/src/lib/validation/image';

interface ImageRegenerateActionProps {
  imageId: string;
  currentOriginalUrl: string;
}

export function ImageRegenerateAction({ imageId, currentOriginalUrl }: ImageRegenerateActionProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState(currentOriginalUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleRegenerate = () => {
    setError(null);
    // 変更なし・空文字は originalUrl を送らず、既存 URL 再利用扱いにする
    const trimmed = inputUrl.trim();
    const body = trimmed && trimmed !== currentOriginalUrl ? { originalUrl: trimmed } : {};

    startTransition(async () => {
      try {
        const res = await fetch(`/api/images/${imageId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.status === 200) {
          // レスポンス本体のシェイプを実行時に検証する (app/api の規約)。
          // 検証失敗はサーバー側の契約違反だが、200 が返っている以上は再生成は完了しているため
          // 警告ログを残しつつ画面をリフレッシュする方向で degrade する。
          const json: unknown = await res.json().catch(() => null);
          const parsed = regenerateImageResponseSchema.safeParse(json);
          if (!parsed.success) {
            console.warn('[ImageRegenerateAction] unexpected response shape', parsed.error);
          }
          setOpen(false);
          router.refresh();
          return;
        }
        const json: unknown = await res.json().catch(() => null);
        const message =
          json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
            ? json.error
            : '再生成に失敗しました';
        setError(message);
      } catch {
        setError('通信エラーが発生しました。時間をおいて再試行してください');
      }
    });
  };

  return (
    <div className="space-y-2">
      <AlertDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            // ダイアログを開くたびに URL とエラーを最新状態にリセット
            setInputUrl(currentOriginalUrl);
            setError(null);
          }
        }}
      >
        <AlertDialogTrigger
          data-testid="image-regenerate-trigger"
          className="text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
          disabled={pending}
        >
          画像を再生成
        </AlertDialogTrigger>
        <AlertDialogContent data-testid="image-regenerate-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>この画像を再生成しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              下の URL から画像を取得し直し、LGTM 画像を作り直します。差し替える場合は URL
              を編集してください。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">元画像 URL</span>
            <input
              data-testid="image-regenerate-url-input"
              type="url"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              disabled={pending}
              className="rounded border border-input bg-background px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              data-testid="image-regenerate-confirm"
              disabled={pending}
              onClick={handleRegenerate}
            >
              {pending ? '再生成中…' : '再生成する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <p role="alert" data-testid="image-regenerate-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
