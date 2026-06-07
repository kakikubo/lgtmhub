import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Cache Components (旧 PPR)。静的シェルを先行配信し、動的部分は Suspense 境界で
  // ストリーミングする。トップページの初期画像一覧は `'use cache'` でキャッシュする。
  cacheComponents: true,
  outputFileTracingRoot: path.resolve(__dirname),
  // Vercel サーバレス関数のバンドルに LGTM 画像合成で参照するフォントを明示的に含める。
  // public/ 配下は静的配信用にデプロイされるが、関数側のファイルシステムからの読み出しは
  // file tracing で検出されたファイルしか保証されないため、文字列パス参照分を補う。
  outputFileTracingIncludes: {
    '/api/images': ['./public/fonts/**/*'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

export default nextConfig;
