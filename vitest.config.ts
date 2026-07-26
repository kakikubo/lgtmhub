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
      // app/api/** も計測対象。tests/unit/api/ が route handler をカバーしているが
      // include が src/** のみだったため成果が集計に現れていなかった (Issue #255)。
      // app/(site)/** は RSC で node 環境の unit テストから import されず、実際は
      // e2e がカバーしている。e2e カバレッジ未収集の現状で含めると恒久 0% になるため除く。
      include: ['src/**/*.ts', 'src/**/*.tsx', 'app/api/**/*.ts'],
      exclude: ['src/types/**', 'src/**/*.test.ts'],
      // 閾値は CI を含め常時ゲート。v8 の function 計測は Node マイナー差で
      // 約 12〜13pt 下振れする (ローカル services 100% / lib 90.9% に対し
      // CI(ubuntu/Node 24.x) で 88.23% / 77.5%) ため、functions のみ CI 実測
      // フロアの下にバッファを取った値へ引き下げる (services 85 / lib 75)。
      // branches/lines/statements は v8-to-istanbul でソースレンジにマップされ
      // 安定し CI 実測でも 90/80 を通過するため据え置く (Issue #113)。
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
        'src/lib/**': { branches: 80, functions: 75, lines: 80, statements: 80 },
        'app/api/images/**': { branches: 80, functions: 95, lines: 90, statements: 90 },
      },
    },
  },
});
