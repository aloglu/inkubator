import { describe, expect, it } from 'vitest';
import { sortInks, sortPens, sortSwatches } from './sorting';
import { fill, ink, pen } from './test-data';
import type { Swatch } from './types/Swatch';

describe('sortPens', () => {
  const a = { ...pen('a', 'Safari'), brand: 'Lamy', created_at: 1, price: 30 };
  const b = { ...pen('b', 'Custom 74'), brand: 'Pilot', created_at: 3, price: null };
  const c = { ...pen('c', '2000'), brand: 'Lamy', created_at: 2, price: 200 };
  const ids = (list: { id: string }[]) => list.map((p) => p.id);

  it('sorts by the chosen order', () => {
    expect(ids(sortPens([a, b, c], 'newest', []))).toEqual(['b', 'c', 'a']);
    expect(ids(sortPens([a, b, c], 'brand', []))).toEqual(['c', 'a', 'b']);
    expect(ids(sortPens([a, b, c], 'model', []))).toEqual(['c', 'b', 'a']);
    expect(ids(sortPens([a, b, c], 'price', []))).toEqual(['c', 'a', 'b']);
  });

  it('puts the most recently inked first and never-inked pens last', () => {
    const fills = [fill('a', 'x', 5, 9), fill('c', 'x', 10, null)];
    expect(ids(sortPens([a, b, c], 'last_inked', fills))).toEqual(['c', 'a', 'b']);
  });
});

describe('sortInks', () => {
  it('groups by color family in shelf order for hue', () => {
    const blue = ink('blue', 'Blue', '#1b6fae');
    const red = ink('red', 'Red', '#c83c28');
    const black = ink('black', 'Black', '#2a2a2e');
    expect(sortInks([black, blue, red], 'hue').map((i) => i.id)).toEqual(['red', 'blue', 'black']);
    expect(sortInks([black, blue, red], 'name').map((i) => i.id)).toEqual(['black', 'blue', 'red']);
  });
});

describe('sortSwatches', () => {
  it('sorts by paper with unnamed papers last', () => {
    const s = (id: string, paper: string): Swatch => ({
      id, ink_id: 'i', paper, nib: '', sampled_on: null, notes: '', notes_public: false, images: [], created_at: 0, updated_at: 0,
    });
    const inks = new Map([['i', ink('i')]]);
    expect(sortSwatches([s('1', ''), s('2', 'Tomoe'), s('3', 'Cosmo')], 'paper', inks).map((x) => x.id)).toEqual(['3', '2', '1']);
  });
});
