import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
