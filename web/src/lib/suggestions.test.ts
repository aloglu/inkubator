import { describe, expect, it } from 'vitest';
import { earlierInks, openFills, pensHolding, restingInks, restingPens } from './suggestions';
import { DAY, fill, ink, pen } from './test-data';

const now = 100 * DAY;

describe('earlierInks', () => {
  it('lists earlier inks most recent first, once each, without the current ink', () => {
    const data = {
      pens: [pen('p')],
      inks: [ink('a'), ink('b'), ink('c')],
      fills: [fill('p', 'a', 1, 5), fill('p', 'b', 5, 9), fill('p', 'a', 9, 20), fill('p', 'c', 20, null)],
    };
    expect(earlierInks(data, 'p').map((e) => e.ink.id)).toEqual(['a', 'b']);
    expect(earlierInks(data, 'p')[0]?.fill.emptied_at).toBe(20 * DAY);
  });

  it('skips inks that were deleted', () => {
    const data = { pens: [pen('p')], inks: [ink('b')], fills: [fill('p', 'gone', 1, 5), fill('p', 'b', 5, 9)] };
    expect(earlierInks(data, 'p').map((e) => e.ink.id)).toEqual(['b']);
  });
});

describe('restingInks', () => {
  it('puts never-used inks first, then the longest unused, and leaves out inks in a pen', () => {
    const data = {
      pens: [pen('p'), pen('q')],
      inks: [ink('recent'), ink('old'), ink('never'), ink('inked')],
      fills: [fill('p', 'old', 1, 10), fill('p', 'recent', 10, 50), fill('q', 'inked', 60, null)],
    };
    expect(restingInks(data, now).map((i) => i.id)).toEqual(['never', 'old', 'recent']);
    expect(restingInks(data, now, new Set(['never'])).map((i) => i.id)).toEqual(['old', 'recent']);
  });
});

describe('restingPens', () => {
  it('lists pens without ink, most recently used first, never-used last', () => {
    const data = {
      pens: [pen('never'), pen('old'), pen('recent'), pen('inked')],
      inks: [ink('a')],
      fills: [fill('old', 'a', 1, 5), fill('recent', 'a', 5, 50), fill('inked', 'a', 60, null)],
    };
    expect(restingPens(data, now).map((p) => p.id)).toEqual(['recent', 'old', 'never']);
  });
});

describe('open fills', () => {
  it('maps pens to their open fill and finds every pen holding an ink', () => {
    const fills = [fill('p', 'a', 1, 5), fill('p', 'b', 5, null), fill('q', 'b', 3, null)];
    expect(openFills(fills).get('p')?.ink_id).toBe('b');
    expect(openFills(fills).size).toBe(2);
    const data = { pens: [pen('p'), pen('q'), pen('r')], inks: [ink('b')], fills };
    expect(pensHolding(data, 'b').map((p) => p.id)).toEqual(['p', 'q']);
  });
});
