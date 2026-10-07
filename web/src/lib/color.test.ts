import { describe, expect, it } from 'vitest';
import { colorFamily } from './color';

describe('colorFamily', () => {
  it.each([
    ['#1f3a5f', 'Blue'],
    ['#1b6fae', 'Blue'],
    ['#7a1f2b', 'Red'],
    ['#2f6b4f', 'Green'],
    ['#1e6b6e', 'Teal'],
    ['#d9a400', 'Yellow'],
    ['#c0602a', 'Orange'],
    ['#5a3a1e', 'Brown'],
    ['#6a3a8a', 'Purple'],
    ['#e07aa8', 'Pink'],
    ['#2a2a2e', 'Black & grey'],
    ['#808080', 'Black & grey'],
  ])('%s is %s', (hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});
