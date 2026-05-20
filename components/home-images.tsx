'use client';

import { useState } from 'react';
import { ImageGrid } from '@/components/image-grid';
import { LoadMoreButton } from '@/components/load-more-button';
import { randomImagesResponseSchema } from '@/src/lib/validation/image';
import type { PublicLgtmImage } from '@/src/types/image';

function EmptyState({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <div
      data-testid="image-list-empty"
      className="rounded border border-dashed bg-gray-50 px-6 py-12 text-center text-sm text-gray-600"
    >
      <p>まだ画像がありません。</p>
      {isLoggedIn ? (
        <p className="mt-2">最初の LGTM 画像を登録してみましょう。</p>
      ) : (
        <p className="mt-2">GitHub でログインすると、画像を登録できます。</p>
      )}
    </div>
  );
}

function LoadErrorState() {
  return (
    <div
      data-testid="image-list-error"
      className="rounded border border-dashed border-amber-300 bg-amber-50 px-6 py-12 text-center text-sm text-amber-800"
    >
      <p>現在画像を読み込めません。</p>
      <p className="mt-2">時間をおいて再度お試しください。</p>
    </div>
  );
}

interface HomeImagesProps {
  initialImages: PublicLgtmImage[];
  initialNextCursor: string | null;
  loadError: boolean;
  isLoggedIn: boolean;
}

/**
 * 一覧の表示モード (通常 / ランダム) を管理するクライアントコンポーネント。
 *
 * - 先頭に常時表示の「ランダム表示」ボタンを置く (Issue #109)。
 * - 通常モード: SSR で渡された新着順 16 枚 + もっと読み込む (#108 の挙動)。
 * - ランダムモード: サーバーで全 active からランダム抽出した 16 枚。
 *   「もっと読み込む」は出さない。再押下で再抽出する。
 * - 状態はクライアントメモリのみ。リロードで SSR の通常表示へ自動的に戻る。
 */
export function HomeImages({
  initialImages,
  initialNextCursor,
  loadError,
  isLoggedIn,
}: HomeImagesProps) {
  const [mode, setMode] = useState<'default' | 'random'>('default');
  const [randomImages, setRandomImages] = useState<PublicLgtmImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRandomClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      // 押下のたびに別の 16 枚を取得するためキャッシュを無効化する
      const res = await fetch('/api/images/random', { cache: 'no-store' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = randomImagesResponseSchema.parse(await res.json());
      const images: PublicLgtmImage[] = json.images.map((img) => ({
        id: img.id,
        imageUrl: img.imageUrl,
        uploaderId: img.uploaderId,
        width: img.width,
        height: img.height,
        createdAt: new Date(img.createdAt),
      }));
      setRandomImages(images);
      setMode('random');
    } catch {
      setError('読み込みに失敗しました。時間をおいて再度お試しください');
    } finally {
      setLoading(false);
    }
  };

  let body: React.ReactNode;
  if (mode === 'random') {
    body =
      randomImages.length === 0 ? (
        <EmptyState isLoggedIn={isLoggedIn} />
      ) : (
        // ランダムモードでも初期表示と同じカード描画。
        // 「もっと読み込む」は描画しない (ランダム順は cursor と不整合のため)。
        <ImageGrid images={randomImages} />
      );
  } else if (loadError) {
    body = <LoadErrorState />;
  } else if (initialImages.length === 0) {
    body = <EmptyState isLoggedIn={isLoggedIn} />;
  } else {
    body = (
      <>
        <ImageGrid images={initialImages} />
        {initialNextCursor ? <LoadMoreButton initialCursor={initialNextCursor} /> : null}
      </>
    );
  }

  return (
    <div className="space-y-6" data-testid="home-images" data-mode={mode}>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleRandomClick}
          disabled={loading}
          data-testid="random-button"
          className="text-sm border px-4 py-2 rounded hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '読み込み中…' : 'ランダム表示'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      {body}
    </div>
  );
}
