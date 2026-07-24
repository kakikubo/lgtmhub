import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom プロジェクト専用の setup。@testing-library/react は globals:true でないと
// 自動 cleanup が登録されないため、明示的に afterEach で DOM を破棄する。
afterEach(() => {
  cleanup();
});
