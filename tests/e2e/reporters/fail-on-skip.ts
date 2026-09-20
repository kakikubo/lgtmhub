import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * skip されたテストが 1 件でもあれば実行を失敗させる reporter (Issue #279)。
 *
 * 以前は「画像が無ければ test.skip()」というガードのせいで、CI の e2e が
 * 何もアサートせずに緑になっていた (サイレント no-op)。同じ構造が再混入しても
 * 気付けるよう、CI では skip 0 を機械的に強制する。
 * ローカルではデバッグ目的の一時的な skip を許容したいので、
 * playwright.config.ts 側で CI のときだけ有効化する。
 */
export default class FailOnSkipReporter implements Reporter {
  private readonly skipped: string[] = [];

  /**
   * Playwright は「stdio に出力する reporter が 1 つも無い」ときだけ既定の dot / line reporter を
   * 足す (runner/index.js の someReporterPrintsToStdio)。printsToStdio 未実装のカスタム reporter は
   * true 扱いになるため、これを false にしないと html reporter と組んだ CI で
   * 進捗も失敗のスタックトレースも出なくなる。
   */
  printsToStdio(): boolean {
    return false;
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'skipped') {
      this.skipped.push(test.titlePath().filter(Boolean).join(' > '));
    }
  }

  // Reporter.onEnd は同期戻り値を受け付けない (void | Promise<...>) ため async にする
  async onEnd(_result: FullResult): Promise<{ status?: FullResult['status'] } | undefined> {
    if (this.skipped.length === 0) return undefined;

    console.error(
      [
        `[fail-on-skip] skip されたテストが ${this.skipped.length} 件あります。`,
        'e2e はシードデータ (supabase/seed.sql) を前提に無条件でアサートする方針です。',
        ...this.skipped.map((title) => `  - ${title}`),
      ].join('\n'),
    );
    return { status: 'failed' };
  }
}
