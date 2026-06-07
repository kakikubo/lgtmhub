'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  CREATE_IMAGE_FALLBACK_MESSAGE,
  mapCreateImageError,
} from '@/src/lib/validation/create-image-error';
import { createImageRequestSchema, createImageResponseSchema } from '@/src/lib/validation/image';

type FormStatus = 'idle' | 'submitting';

export function ImageRegisterForm() {
  const router = useRouter();
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showReloginLink, setShowReloginLink] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'submitting') return;

    setErrorMessage(null);
    setShowReloginLink(false);

    const trimmed = imageUrl.trim();
    const validated = createImageRequestSchema.safeParse({ imageUrl: trimmed });
    if (!validated.success) {
      setErrorMessage(validated.error.issues[0]?.message ?? '入力値が不正です');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: validated.data.imageUrl }),
      });
      const json: unknown = await res.json().catch(() => null);

      if (res.ok) {
        const parsed = createImageResponseSchema.safeParse(json);
        if (!parsed.success) {
          setErrorMessage(CREATE_IMAGE_FALLBACK_MESSAGE);
          return;
        }
        // cacheComponents 下では navigation をまたいでクライアント state が保持され得るため、
        // 再訪時に古い URL が入力欄へ残らないよう明示的にリセットする。
        setImageUrl('');
        // /(site)/page.tsx の Server Component キャッシュを破棄して
        // 登録した画像が一覧の先頭に出る状態でトップに戻す
        router.refresh();
        router.push('/');
        return;
      }

      const mapped = mapCreateImageError(res.status, json);
      setErrorMessage(mapped.message);
      if (mapped.needsRelogin) setShowReloginLink(true);
      // mapped.existingImageId は 409 のときに取れるが、/images/[id] が未実装の本 PR では使わない。
      // 詳細ページ実装時に「既存画像を見る」リンクとして state 化する
    } catch {
      setErrorMessage(CREATE_IMAGE_FALLBACK_MESSAGE);
    } finally {
      setStatus('idle');
    }
  };

  const isSubmitting = status === 'submitting';

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="image-register-form"
      className="space-y-4"
      // ブラウザネイティブの URL バリデーション UI は zod のメッセージと二重表示になるため抑制する
      noValidate
    >
      <div className="space-y-2">
        <label htmlFor="image-url" className="block text-sm font-medium">
          画像 URL
        </label>
        <input
          id="image-url"
          type="url"
          required
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://example.com/cat.jpg"
          data-testid="image-register-input"
          disabled={isSubmitting}
          className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-100"
        />
        <p className="text-xs text-gray-500">
          HTTPS の URL のみ受け付けます。JPEG / PNG / GIF (最大 10MB) に対応しています。
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" data-testid="image-register-error" className="text-sm text-red-600">
          {errorMessage}
          {showReloginLink ? (
            <>
              {' '}
              <Link href="/?auth_error=login_required" className="underline hover:text-red-800">
                トップへ戻る
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="image-register-submit"
          aria-busy={isSubmitting}
          className="text-sm bg-gray-900 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {isSubmitting ? '登録中…' : '登録する'}
        </button>
        <Link
          href="/"
          className="text-sm text-gray-600 hover:text-gray-900"
          aria-disabled={isSubmitting}
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}
