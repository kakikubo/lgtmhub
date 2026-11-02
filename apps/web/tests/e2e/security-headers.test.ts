import { expect, test } from '@playwright/test';
import { SEED_IMAGES } from './fixtures/seed-images';

// Issue #276: CSP は Report-Only で導入している。enforce に切り替えても主要ページが壊れないことを、
// Report-Only でも発火する securitypolicyviolation イベントが 0 件であることで担保する。

const PATHS = ['/', `/images/${SEED_IMAGES[0].id}`, '/favorites', '/images/new'];

declare global {
  interface Window {
    __cspViolations?: string[];
  }
}

for (const path of PATHS) {
  test(`${path} で CSP 違反が発生しない`, async ({ page }) => {
    await page.addInitScript(() => {
      window.__cspViolations = [];
      document.addEventListener('securitypolicyviolation', (event) => {
        window.__cspViolations?.push(
          `${event.effectiveDirective} ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}:${event.columnNumber} ${event.sample}`,
        );
      });
    });

    const response = await page.goto(path);
    expect(response?.headers()['content-security-policy-report-only']).toContain(
      "default-src 'self'",
    );
    expect(response?.headers()['strict-transport-security']).toBe(
      'max-age=63072000; includeSubDomains',
    );

    // hydration と遅延読み込みの画像まで待ってから集計する
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => window.__cspViolations)).toEqual([]);
  });
}
