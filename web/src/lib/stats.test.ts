import { describe, expect, it } from 'vitest';
import { byBrand, headline, rangeStart, rotation } from './stats';
import { DAY, fill, ink, pen } from './test-data';

const now = 100 * DAY;

describe('rotation', () => {
  it('clips fills to the period and orders pens by most recent use', () => {
    const c = {
      pens: [pen('a'), pen('b'), pen('c')],
      inks: [ink('x'), ink('y')],
      fills: [fill('a', 'x', 5, 20), fill('a', 'y', 20, 80), fill('b', 'x', 50, null), fill('c', 'y', 1, 5)],
    };
    const rows = rotation(c, now - 90 * DAY, now);
    expect(rows.map((r) => r.pen.id)).toEqual(['b', 'a']);
    const a = rows[1]!;
    expect(a.segments.map((s) => [s.start / DAY, s.end / DAY])).toEqual([[10, 20], [20, 80]]);
    expect(rows[0]!.segments[0]).toMatchObject({ open: true, end: now });
  });

  it('starts "all" at the first fill', () => {
    expect(rangeStart('all', [fill('a', 'x', 7, null), fill('a', 'x', 3, 7)], now)).toBe(3 * DAY);
    expect(rangeStart(30, [], now)).toBe(70 * DAY);
  });
});

describe('headline', () => {
  it('counts inked pens, average finished fill, swatched inks and spend', () => {
    const c = {
      pens: [{ ...pen('a'), price: 100 }, { ...pen('b'), price: null }],
      inks: [{ ...ink('x'), price: 20, amount: 2 }, ink('y')],
      fills: [fill('a', 'x', 10, 20), fill('a', 'y', 20, 50), fill('b', 'x', 60, null)],
      swatches: [{ id: 's', ink_id: 'x', paper: '', nib: '', sampled_on: null, notes: '', notes_public: false, images: [], created_at: 0, updated_at: 0 }],
    };
    expect(headline(c, 0, now)).toEqual({ inked: 1, pens: 2, averageFill: 20, swatched: 1, inks: 2, spend: 140 });
    expect(headline(c, 55 * DAY, now).averageFill).toBeNull();
  });
});

describe('byBrand', () => {
  it('totals per brand, largest first, skipping unknown values', () => {
    const items = [
      { brand: 'Pilot', price: 30 },
      { brand: 'Lamy', price: 50 },
      { brand: 'Pilot', price: 25 },
      { brand: 'Kaweco', price: null },
    ];
    expect(byBrand(items, (i) => i.price)).toEqual([
      { brand: 'Pilot', value: 55 },
      { brand: 'Lamy', value: 50 },
    ]);
  });
});
