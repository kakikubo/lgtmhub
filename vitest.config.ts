import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      // lcov: Codecov が解釈する標準フォーマット (coverage/lcov.info を生成)
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/types/**', 'src/**/*.test.ts'],
      // 閾値は CI を含め常時ゲート。v8 の function 計測は Node マイナー差で
      // 約 12〜13pt 下振れする (ローカル services 100% / lib 90.9% に対し
      // CI(ubuntu/Node 24.x) で 88.23% / 77.5%) ため、functions のみ CI 実測
      // フロアの下にバッファを取った値へ引き下げる (services 85 / lib 75)。
      // branches/lines/statements は v8-to-istanbul でソースレンジにマップされ
      // 安定し CI 実測でも 90/80 を通過するため据え置く (Issue #113)。
      thresholds: {
        'src/services/**': { branches: 90, functions: 85, lines: 90, statements: 90 },
        'src/lib/**': { branches: 80, functions: 75, lines: 80, statements: 80 },
      },
    },
  },
});
