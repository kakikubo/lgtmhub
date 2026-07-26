import path from 'node:path';
import type { NextConfig } from 'next';

// sharp 0.35 以降は libvips が `@img/sharp-libvips-<platform>` という platform-specific
// optional dep に分離された。Next.js は sharp を external 扱いするため、
// Vercel ランタイム (linux-x64 glibc) のバンドルに `.so` がトレースされず
// `ERR_DLOPEN_FAILED: libvips-cpp.so.*` で落ちる。trace に明示して .nft.json に含める。
//
// pnpm は `node_modules/@img/...` を `.pnpm/...` への symlink にするため、
// symlink 経由のパスで trace すると Vercel が「invalid deployment package
// (files in symlinked directories)」で reject する。.pnpm 配下の実体パスを直接指す。
const SHARP_LINUX_X64_TRACE = [
  './node_modules/.pnpm/@img+sharp-libvips-linux-x64@*/node_modules/@img/sharp-libvips-linux-x64/**/*',
  './node_modules/.pnpm/@img+sharp-linux-x64@*/node_modules/@img/sharp-linux-x64/**/*',
];

const nextConfig: NextConfig = {
  // Cache Components (旧 PPR)。静的シェルを先行配信し、動的部分は Suspense 境界で
  // ストリーミングする。トップページの初期画像一覧は `'use cache'` でキャッシュする。
  cacheComponents: true,
  outputFileTracingRoot: path.resolve(__dirname),
  // Vercel サーバレス関数のバンドルに LGTM 画像合成で参照するフォントを明示的に含める。
  // public/ 配下は静的配信用にデプロイされるが、関数側のファイルシステムからの読み出しは
  // file tracing で検出されたファイルしか保証されないため、文字列パス参照分を補う。
  outputFileTracingIncludes: {
    '/api/images': ['./public/fonts/**/*', ...SHARP_LINUX_X64_TRACE],
    '/api/images/[id]': SHARP_LINUX_X64_TRACE,
    '/api/images/random': SHARP_LINUX_X64_TRACE,
    '/': SHARP_LINUX_X64_TRACE,
    '/images/[id]': SHARP_LINUX_X64_TRACE,
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
