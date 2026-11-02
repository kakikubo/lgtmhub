import type { PublicLgtmImage } from '@/src/types/image';

/** fetch モックが返す最小 Response。json() と ok/status のみ実装する */
export function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

/** テスト用の PublicLgtmImage を生成する */
export function makeImage(overrides: Partial<PublicLgtmImage> = {}): PublicLgtmImage {
  return {
    id: 'img-1',
    imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
    uploaderId: 'user-1',
    width: 266,
    height: 199,
    isAnimated: false,
    createdAt: new Date('2026-05-18T00:00:00.000Z'),
    ...overrides,
  };
}

/** API レスポンス (imageListItemSchema) 形状の生データ。createdAt は ISO 文字列 */
export function makeApiImage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'img-1',
    imageUrl: 'https://blob.example.com/lgtm/img-1.webp',
    uploaderId: 'user-1',
    width: 266,
    height: 199,
    isAnimated: false,
    createdAt: '2026-05-18T00:00:00.000Z',
    ...overrides,
  };
}
