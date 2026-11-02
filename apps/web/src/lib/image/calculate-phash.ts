import sharp from 'sharp';

export const PHASH_LENGTH = 32 * 32;
export const DUPLICATE_THRESHOLD = 10;

export async function calculatePHash(buffer: Buffer): Promise<string> {
  const pixels = await sharp(buffer).resize(32, 32, { fit: 'fill' }).grayscale().raw().toBuffer();

  let total = 0;
  for (const value of pixels) total += value;
  const avg = total / pixels.length;

  let bits = '';
  for (const value of pixels) bits += value >= avg ? '1' : '0';
  return bits;
}

export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new Error('hammingDistance: 長さが一致しません');
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) diff++;
  }
  return diff;
}

export function isDuplicate(a: string, b: string): boolean {
  return hammingDistance(a, b) <= DUPLICATE_THRESHOLD;
}
