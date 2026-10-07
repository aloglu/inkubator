import { describe, expect, it } from 'vitest';
import { inkFacets, penFacets } from './facets';
import { applyFilters, options } from './filters';
import { fill, ink, pen } from './test-data';

describe('pen facets', () => {
  it('counts "Converter, Cartridge" under both and knows which pens are inked', () => {
    const a = { ...pen('a'), filling_system: 'Converter, Cartridge' };
    const b = { ...pen('b'), filling_system: 'Cartridge' };
    const facets = penFacets({ fills: [fill('a', 'x', 1, null)] });
    const filling = facets.find((f) => f.key === 'filling')!;
    expect(options(filling, [a, b])).toEqual([
      { value: 'Cartridge', label: 'Cartridge', count: 2 },
      { value: 'Converter', label: 'Converter', count: 1 },
    ]);
    expect(applyFilters([a, b], facets, { status: ['resting'] }).map((p) => p.id)).toEqual(['b']);
  });
});

describe('ink facets', () => {
  it('filters by color family, character and use', () => {
    const blue = { ...ink('blue', 'Blue', '#1b6fae'), sheen: 'high' as const };
    const red = ink('red', 'Red', '#c83c28');
    const facets = inkFacets({ fills: [fill('p', 'red', 1, null)], swatches: [] });
    expect(applyFilters([blue, red], facets, { color: ['blue'] }).map((i) => i.id)).toEqual(['blue']);
    expect(applyFilters([blue, red], facets, { has: ['sheen'] }).map((i) => i.id)).toEqual(['blue']);
    expect(applyFilters([blue, red], facets, { in_use: ['yes'] }).map((i) => i.id)).toEqual(['red']);
    expect(applyFilters([blue, red], facets, { swatch: ['no'] })).toHaveLength(2);
  });
});
