import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_THRESHOLD,
  PHASH_LENGTH,
  calculatePHash,
  hammingDistance,
  isDuplicate,
} from '@/src/lib/image/calculate-phash';

async function svgImage(label: string): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
    <rect width="200" height="200" fill="white"/>
    <text x="100" y="120" font-size="120" text-anchor="middle" font-family="sans-serif" fill="black">${label}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('calculatePHash', () => {
  it('同じ画像から同じ pHash が生成される', async () => {
    const buffer = await svgImage('A');
    const a = await calculatePHash(buffer);
    const b = await calculatePHash(buffer);
    expect(a).toBe(b);
  });

  it('長さが PHASH_LENGTH (1024) ビットになる', async () => {
    const buffer = await svgImage('A');
    const hash = await calculatePHash(buffer);
    expect(hash).toHaveLength(PHASH_LENGTH);
    expect(/^[01]+$/.test(hash)).toBe(true);
  });

  it('異なる画像からは閾値より大きく異なる pHash が生成される', async () => {
    const a = await calculatePHash(await svgImage('A'));
    const b = await calculatePHash(await svgImage('XXXXXX'));
    expect(hammingDistance(a, b)).toBeGreaterThan(DUPLICATE_THRESHOLD);
  });
});

describe('hammingDistance', () => {
  it('完全一致は 0', () => {
    expect(hammingDistance('1010', '1010')).toBe(0);
  });

  it('1 ビット差は 1', () => {
    expect(hammingDistance('1010', '1011')).toBe(1);
  });

  it('全ビット反転は文字列長と同じ', () => {
    expect(hammingDistance('1010', '0101')).toBe(4);
  });

  it('長さが一致しない場合は throw する', () => {
    expect(() => hammingDistance('1010', '101')).toThrow('長さ');
  });
});

describe('isDuplicate', () => {
  it('閾値以下なら重複扱い', () => {
    const base = '0'.repeat(1024);
    const diff = '1'.repeat(DUPLICATE_THRESHOLD) + '0'.repeat(1024 - DUPLICATE_THRESHOLD);
    expect(isDuplicate(base, diff)).toBe(true);
  });

  it('閾値を超えると重複扱いにしない', () => {
    const base = '0'.repeat(1024);
    const diff = '1'.repeat(DUPLICATE_THRESHOLD + 1) + '0'.repeat(1024 - DUPLICATE_THRESHOLD - 1);
    expect(isDuplicate(base, diff)).toBe(false);
  });
});
