import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// v8 の function カバレッジ計測は Node のマイナーバージョン差で数 % ブレる。
// 閾値はローカル / devcontainer での開発者の自己チェック用ゲートとして残し、
// CI では Codecov 可視化目的で計測のみ行いゲートにしない
// (VITEST_DISABLE_THRESHOLDS=true)。新規ゲート化は本対応のスコープ外
// (.steering/20260517-add-codecov/requirements.md)。テスト失敗自体は閾値と
// 無関係に vitest が非 0 終了するため CI の test ジョブのゲートは維持される。
const enforceThresholds = process.env.VITEST_DISABLE_THRESHOLDS !== 'true';

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
      ...(enforceThresholds
        ? {
            thresholds: {
              'src/services/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
              'src/lib/**': { branches: 80, functions: 80, lines: 80, statements: 80 },
            },
          }
        : {}),
    },
  },
});
