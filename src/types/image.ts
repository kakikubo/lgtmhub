export type ImageStatus = 'processing' | 'active' | 'deleted';

export interface LgtmImage {
  id: string;
  uploaderId: string;
  originalUrl: string;
  imageUrl: string;
  pHash: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  status: ImageStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
