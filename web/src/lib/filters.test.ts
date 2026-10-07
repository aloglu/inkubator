import { describe, expect, it } from 'vitest';
import { activeCount, applyFilters, chips, options, usefulFacets, type Facet } from './filters';

type Pen = { brand: string; nib: string; inked: boolean };
const pens: Pen[] = [
  { brand: 'Pilot', nib: 'F', inked: true },
  { brand: 'Pilot', nib: 'M', inked: false },
  { brand: 'Lamy', nib: 'F', inked: false },
  { brand: 'Sailor', nib: 'F', inked: false },
];
const brand: Facet<Pen> = { key: 'brand', label: 'Brand', style: 'list', values: (p) => [p.brand] };
const nib: Facet<Pen> = { key: 'nib', label: 'Nib size', style: 'chips', values: (p) => [p.nib], order: ['EF', 'F', 'M'] };
const status: Facet<Pen> = {
  key: 'status',
  label: 'Status',
  style: 'chips',
  values: (p) => [p.inked ? 'inked' : 'resting'],
  name: (v) => (v === 'inked' ? 'Inked' : 'Resting'),
};
const same: Facet<Pen> = { key: 'kind', label: 'Kind', style: 'chips', values: () => ['pen'] };

describe('options', () => {
  it('counts items per value, most common first, or in a fixed order', () => {
    expect(options(brand, pens)).toEqual([
      { value: 'Pilot', label: 'Pilot', count: 2 },
      { value: 'Lamy', label: 'Lamy', count: 1 },
      { value: 'Sailor', label: 'Sailor', count: 1 },
    ]);
    expect(options(nib, pens).map((o) => o.value)).toEqual(['F', 'M']);
    expect(options(status, pens)[0]).toEqual({ value: 'resting', label: 'Resting', count: 3 });
  });

  it('hides facets that cannot tell items apart', () => {
    expect(usefulFacets([brand, same], pens)).toEqual([brand]);
  });
});

describe('applyFilters', () => {
  it('matches any value within a facet and every facet', () => {
    const facets = [brand, nib, status];
    expect(applyFilters(pens, facets, {})).toHaveLength(4);
    expect(applyFilters(pens, facets, { brand: ['Pilot', 'Lamy'] })).toHaveLength(3);
    expect(applyFilters(pens, facets, { brand: ['Pilot', 'Lamy'], nib: ['F'] })).toHaveLength(2);
    expect(applyFilters(pens, facets, { brand: ['Pilot'], nib: ['F'], status: ['resting'] })).toHaveLength(0);
  });

  it('describes active filters as chips', () => {
    const selection = { brand: ['Pilot', 'Lamy'], nib: [], status: ['inked'] };
    expect(chips([brand, nib, status], selection)).toEqual([
      { key: 'brand', label: 'Brand', values: 'Pilot, Lamy' },
      { key: 'status', label: 'Status', values: 'Inked' },
    ]);
    expect(activeCount(selection)).toBe(2);
  });
});
