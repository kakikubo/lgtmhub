import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CopyMarkdownButton } from '@/components/copy-markdown-button';
import { ImageDetailActions } from '@/components/image-detail-actions';
import { ImageRegenerateAction } from '@/components/image-regenerate-action';
import { UploaderProfileRow } from '@/components/uploader-profile-row';
import { createClient } from '@/src/lib/supabase/server';
import { buildImageService } from '@/src/services/image-service';
import { buildUserProfileService } from '@/src/services/user-profile-service';
import type { PublicLgtmImageDetail } from '@/src/types/image';
import type { UserProfile } from '@/src/types/user';

interface ImageDetailPageProps {
  params: Promise<{ id: string }>;
}

interface DetailViewProps {
  image: PublicLgtmImageDetail;
  uploader: UserProfile | null;
  isOwner: boolean;
  isAdmin: boolean;
}

function DetailView({ image, uploader, isOwner, isAdmin }: DetailViewProps) {
  return (
    <section data-testid="image-detail-page" className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <Link
        href="/"
        data-testid="image-detail-back-link"
        className="inline-block text-sm text-gray-600 hover:text-gray-900"
      >
        ← 一覧に戻る
      </Link>

      <div
        data-testid="image-detail-image"
        className="mx-auto max-w-[400px] overflow-hidden rounded border bg-gray-50"
      >
        <Image
          src={image.imageUrl}
          alt="LGTM"
          width={image.width}
          height={image.height}
          sizes="(min-width: 768px) 400px, 100vw"
          priority
          // Next.js Image Optimizer はアニメーション WebP のフレームを 1 枚に
          // 潰してしまうため、アニメ画像のときだけ最適化をスキップする (Issue #201)。
          // 静止画は Optimizer のサイズ圧縮 / フォーマット選択を活かす。
          unoptimized={image.isAnimated}
          className="h-auto w-full"
        />
      </div>

      <UploaderProfileRow profile={uploader} />

      <CopyMarkdownButton imageUrl={image.imageUrl} />

      {isOwner ? <ImageDetailActions imageId={image.id} /> : null}
      {isAdmin ? (
        <ImageRegenerateAction imageId={image.id} currentOriginalUrl={image.originalUrl} />
      ) : null}
    </section>
  );
}

export default async function ImageDetailPage({ params }: ImageDetailPageProps) {
  const { id } = await params;

  // Server Component から Service を直呼びする (architecture.md 例外)。
  // 画像取得とユーザー取得は独立しているため Promise.all で並列化し LCP を維持する。
  // DB 障害時は 500 化せず notFound() に倒す: 詳細ページは「個別画像が見えない」こと自体が
  // 本質的な失敗で、エラー画面より 404 の方が UX 上自然
  const supabase = await createClient();
  const [imageResult, userResult] = await Promise.all([
    buildImageService(supabase)
      .getImageDetail(id)
      .catch((err: unknown) => {
        console.error('[ImageDetailPage] failed to load image', err);
        return null as PublicLgtmImageDetail | null;
      }),
    supabase.auth.getUser(),
  ]);

  if (!imageResult) {
    notFound();
  }

  // 投稿者プロフィールと閲覧者プロフィール (is_admin 判定) を並列取得する。
  // 詳細ページは 1 件のみなので findById で十分 (N+1 を避けるための findManyByIds は不要)。
  // 取得失敗時は null / false へ degrade する
  const user = userResult.data.user;
  const profileService = buildUserProfileService(supabase);
  const [uploader, viewerProfile] = await Promise.all([
    profileService.findById(imageResult.uploaderId).catch((err: unknown) => {
      console.error('[ImageDetailPage] failed to load uploader profile', err);
      return null;
    }),
    user
      ? profileService.findById(user.id).catch((err: unknown) => {
          console.error('[ImageDetailPage] failed to load viewer profile', err);
          return null;
        })
      : Promise.resolve(null),
  ]);

  // 所有者判定・管理者判定だけクライアントに渡す。認証情報そのものは流さない
  const isOwner = !!user && user.id === imageResult.uploaderId;
  const isAdmin = viewerProfile?.isAdmin === true;

  return <DetailView image={imageResult} uploader={uploader} isOwner={isOwner} isAdmin={isAdmin} />;
}
