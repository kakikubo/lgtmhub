import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // node と happy-dom を projects で分離する。大半のテスト (repositories/services/lib/
    // route handler) は node で動くが、components/ のクライアント/サーバコンポーネントは
    // DOM が要るため happy-dom で動かす (Issue #257)。environmentMatchGlobs は vitest 4 で
    // deprecated のため projects を採用。coverage はトップレベルに置きプロジェクト横断で集計する。
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: ['tests/e2e/**', 'tests/unit/components/**'],
        },
      },
      {
        extends: true,
        test: {
          name: 'happy-dom',
          environment: 'happy-dom',
          include: ['tests/unit/components/**/*.test.tsx'],
          setupFiles: ['tests/setup/component-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      // lcov: Codecov が解釈する標準フォーマット (coverage/lcov.info を生成)
      reporter: ['text', 'json', 'html', 'lcov'],
      // app/api/** も計測対象。tests/unit/api/ が route handler をカバーしているが
      // include が src/** のみだったため成果が集計に現れていなかった (Issue #255)。
      // app/(site)/** は RSC で node 環境の unit テストから import されず、実際は
      // e2e がカバーしている。e2e カバレッジ未収集の現状で含めると恒久 0% になるため除く。
      // components/** も計測対象 (Issue #257)。実ロジックを持つ 10 コンポーネントを
      // tests/unit/components/ でカバーする。components/ui/** は vendored な shadcn、
      // *-skeleton.tsx は描画のみのため計測から除外する。
      include: ['src/**/*.ts', 'src/**/*.tsx', 'app/api/**/*.ts', 'components/**/*.{ts,tsx}'],
      exclude: [
        'src/types/**',
        'src/**/*.test.ts',
        'components/ui/**',
        'components/**/*-skeleton.tsx',
      ],
      // 閾値は CI を含め常時ゲート。#113 当時は v8 の functions 計測が CI で
      // 12〜13pt 下振れしたため functions だけ引き下げていたが、現在は CI 8 run と
      // ローカルが per-file で一致し下振れは無い (Issue #266)。lib は実測 84.78%
      // (39/46) に対し他指標と揃えて 80、services は実測 89.74% (35/39) に対し 85。
      // いずれも未テスト関数の追加 3 つで落ちる幅で、主な未カバーは unit テストで
      // モックされる src/lib/supabase/* のクライアント生成関数。
      // app/api/images/** の閾値は CI 実測 (statements 95.49 / branches 85 /
      // functions 100 / lines 95.41) の下にバッファを取った値 (Issue #259)。
      // glob 閾値はマッチしたファイル群の「集計」に対して効く (ファイル単位ではない)。
      // app/api/auth/** に閾値を置かないのは意図的。両 route の未カバー関数は
      // createServerClient に渡す cookie アダプタ (getAll/setAll) で、unit テストでは
      // @supabase/ssr をモックするため呼ばれようがなく、集計 functions が 36.36% に
      // 沈む。ここを閾値化しても到達不能コードに引きずられた数値を固定するだけで
      // ゲートとして機能しない (実際に呼ばれる経路は e2e が担保する)。
      thresholds: {
        'src/services/**': { branches: 90, functions: 85, lines: 90, statements: 90 },
        'src/lib/**': { branches: 80, functions: 80, lines: 80, statements: 80 },
        'app/api/images/**': { branches: 80, functions: 95, lines: 90, statements: 90 },
      },
    },
  },
});
