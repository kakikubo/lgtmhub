import { ImageCard } from '@/components/image-card';
import type { PublicLgtmImage } from '@/src/types/image';

interface ImageGridProps {
  images: PublicLgtmImage[];
  testId?: string;
}

export function ImageGrid({ images, testId = 'image-grid' }: ImageGridProps) {
  return (
    <ul data-testid={testId} className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {images.map((image) => (
        <li key={image.id}>
          <ImageCard image={image} />
        </li>
      ))}
    </ul>
  );
}
