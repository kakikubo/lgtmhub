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

interface ImageDetailActionsProps {
  imageId: string;
}

export function ImageDetailActions({ imageId }: ImageDetailActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/images/${imageId}`, { method: 'DELETE' });
        if (res.status === 204) {
          // 一覧 Server Component キャッシュを破棄してから戻す
          router.refresh();
          router.push('/');
          return;
        }
        const json: unknown = await res.json().catch(() => null);
        const message =
          json && typeof json === 'object' && 'error' in json && typeof json.error === 'string'
            ? json.error
            : '削除に失敗しました';
        setError(message);
      } catch {
        setError('通信エラーが発生しました。時間をおいて再試行してください');
      }
    });
  };

  return (
    <div className="space-y-2">
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger
          data-testid="image-delete-trigger"
          className="text-sm text-red-600 hover:text-red-800 underline disabled:opacity-50"
          disabled={pending}
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
              variant="destructive"
            >
              {pending ? '削除中…' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error ? (
        <p role="alert" data-testid="image-delete-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
