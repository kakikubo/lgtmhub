import { ImageCard } from '@/components/image-card';
import type { PublicLgtmImage } from '@/src/types/image';

interface ImageGridProps {
  images: PublicLgtmImage[];
  testId?: string;
}

// xl:grid-cols-4 の 1 行目をファーストビューとみなし、LCP 候補として preload する
const PRIORITY_IMAGE_COUNT = 4;

export function ImageGrid({ images, testId = 'image-grid' }: ImageGridProps) {
  return (
    <ul data-testid={testId} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {images.map((image, index) => (
        <li key={image.id}>
          <ImageCard image={image} priority={index < PRIORITY_IMAGE_COUNT} />
        </li>
      ))}
    </ul>
  );
}
