import { describe, expect, it } from 'vitest';
import { isPurchaseDate, nibSizes, suggestions } from './pen';

describe('suggestions', () => {
  it('puts the collection’s own values first, most used first, then standard ones', () => {
    const used = ['M', 'F', 'F', 'LH', 'f', '', '3.8'];
    expect(suggestions(used, nibSizes, 6)).toEqual(['F', 'M', 'LH', '3.8', 'EF', 'MF']);
  });
});

describe('isPurchaseDate', () => {
  it('accepts a day or a month', () => {
    expect(isPurchaseDate('2024-05')).toBe(true);
    expect(isPurchaseDate('2024-05-17')).toBe(true);
    expect(isPurchaseDate('2024-02-30')).toBe(false);
    expect(isPurchaseDate('2024-13')).toBe(false);
    expect(isPurchaseDate('May 2024')).toBe(false);
  });
});
