'use client';

import { useState } from 'react';
import { ImageGrid } from '@/components/image-grid';
import { listImagesResponseSchema } from '@/src/lib/validation/image';
import type { PublicLgtmImage } from '@/src/types/image';
import type { UserProfile } from '@/src/types/user';

export function LoadMoreButton({ initialCursor }: { initialCursor: string }) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [extra, setExtra] = useState<PublicLgtmImage[]>([]);
  // extra は複数ページ分を 1 つの ImageGrid でまとめて描画するため、
  // プロフィールもページをまたいで蓄積する (uploaderId をキーに上書きマージ)。
  const [profiles, setProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!cursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const url = `/api/images?cursor=${encodeURIComponent(cursor)}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      // res.json() は any を返すため zod で runtime バリデーションし、型安全に PublicLgtmImage へ変換する
      const json = listImagesResponseSchema.parse(await res.json());
      const restored: PublicLgtmImage[] = json.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        uploaderId: img.uploaderId,
        width: img.width,
        height: img.height,
        createdAt: new Date(img.createdAt),
      }));
      const restoredProfiles: UserProfile[] = json.profiles.map((p) => ({
        id: p.id,
        githubLogin: p.githubLogin,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        isAdmin: p.isAdmin,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
      }));
      setExtra((prev) => [...prev, ...restored]);
      setProfiles((prev) => {
        const next = new Map(prev);
        for (const profile of restoredProfiles) next.set(profile.id, profile);
        return next;
      });
      setCursor(json.nextCursor);
    } catch {
      setError('読み込みに失敗しました。時間をおいて再度お試しください');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {extra.length > 0 && (
        <ImageGrid images={extra} profiles={profiles} testId="image-grid-extra" />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {cursor && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            data-testid="load-more-button"
            className="text-sm border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? '読み込み中…' : 'もっと読み込む'}
          </button>
        </div>
      )}
    </div>
  );
}
