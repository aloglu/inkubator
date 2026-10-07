import { describe, expect, it } from 'vitest';
import { fold, rank } from './search';

const pens = [
  { model: 'Custom 74', brand: 'Pilot' },
  { model: 'Kaküno', brand: 'Pilot' },
  { model: 'Safari', brand: 'Lamy' },
  { model: 'Pilot Parallel', brand: 'Pilot' },
];
const fields = (p: (typeof pens)[number]) => [p.model, p.brand];

describe('rank', () => {
  it('ignores case and accents', () => {
    expect(fold('Kaküno')).toBe('kakuno');
    expect(rank(pens, fields, 'KAKUNO').map((p) => p.model)).toEqual(['Kaküno']);
  });

  it('needs every word to match', () => {
    expect(rank(pens, fields, 'pilot custom').map((p) => p.model)).toEqual(['Custom 74']);
    expect(rank(pens, fields, 'lamy custom')).toEqual([]);
  });

  it('prefers matches in earlier fields and at the start of words', () => {
    expect(rank(pens, fields, 'pilot')[0]?.model).toBe('Pilot Parallel');
    expect(rank(pens, fields, 'saf')[0]?.model).toBe('Safari');
  });

  it('returns nothing for an empty query and respects the limit', () => {
    expect(rank(pens, fields, '  ')).toEqual([]);
    expect(rank(pens, fields, 'pilot', 2)).toHaveLength(2);
  });
});
