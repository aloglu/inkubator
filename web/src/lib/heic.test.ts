import { describe, expect, it } from 'vitest';
import { isHeicBytes } from './heic';

const ftyp = (brand: string, compatible = 'mif1') =>
  new Uint8Array([0, 0, 0, 24, ...[...'ftyp', ...brand, 0, 0, 0, 0, ...compatible].map((c) => (typeof c === 'string' ? c.charCodeAt(0) : c))]);

describe('isHeicBytes', () => {
  it('recognises HEIC by its file header', () => {
    expect(isHeicBytes(ftyp('heic'))).toBe(true);
    expect(isHeicBytes(ftyp('mif1', 'heic'))).toBe(true);
  });

  it('leaves other photos alone', () => {
    expect(isHeicBytes(ftyp('avif', 'avif'))).toBe(false);
    expect(isHeicBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(false);
    expect(isHeicBytes(new Uint8Array(4))).toBe(false);
  });
});
