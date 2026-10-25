import { afterEach, describe, expect, it, vi } from 'vitest';

// Issue #276 / PR #368 の回帰テスト。
// Zod v4 は z.object() の生成時に `new Function('')` で JIT 可否を判定し、ブラウザでは
// CSP の securitypolicyviolation を発火させる。スキーマを定義するモジュールを読み込んだ時点で
// この判定が一度も走らない (= jitless がスキーマ生成より先に効いている) ことを確かめる。
describe('zod-config (jitless)', () => {
  const originalFunction = globalThis.Function;

  afterEach(() => {
    globalThis.Function = originalFunction;
  });

  const modules = [
    '@/src/lib/pagination/keyset-cursor',
    '@/src/lib/validation/image',
    '@/src/lib/validation/favorite',
  ];

  it.each(modules)('%s の読み込みと parse で Function コンストラクタを呼ばない', async (path) => {
    vi.resetModules();
    let probes = 0;
    globalThis.Function = new Proxy(originalFunction, {
      construct(target, args) {
        probes++;
        return Reflect.construct(target, args);
      },
      apply(target, thisArg, args) {
        probes++;
        return Reflect.apply(target, thisArg, args);
      },
    });

    const mod: unknown = await import(path);
    const { keysetCursorQuerySchema } = await import('@/src/lib/pagination/keyset-cursor');
    keysetCursorQuerySchema.safeParse(
      JSON.stringify({
        createdAt: '2026-10-25T00:00:00.000Z',
        id: '00000000-0000-4000-8000-000000000000',
      }),
    );

    expect(mod).toBeDefined();
    expect(probes).toBe(0);
  });
});
