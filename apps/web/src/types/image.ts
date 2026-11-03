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
  // アニメーション WebP として保存されたかどうか。
  // 一覧／詳細の表示分岐 (UI バッジ等) に利用する想定。
  isAnimated: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicLgtmImage {
  id: string;
  imageUrl: string;
  uploaderId: string;
  width: number;
  height: number;
  isAnimated: boolean;
  createdAt: Date;
}

// 詳細ページ・管理者操作 (再生成) 用。一覧で不要な originalUrl を持たせるため PublicLgtmImage を継承する。
export interface PublicLgtmImageDetail extends PublicLgtmImage {
  originalUrl: string;
}
