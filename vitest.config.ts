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
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/types/**', 'src/**/*.test.ts'],
      thresholds: {
        'src/services/**': { branches: 90, functions: 90, lines: 90, statements: 90 },
        'src/lib/**': { branches: 80, functions: 80, lines: 80, statements: 80 },
      },
    },
  },
});
