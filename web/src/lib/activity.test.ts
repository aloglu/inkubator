import { describe, expect, it } from 'vitest';
import { changeLine, fieldName, showValue, verb, type Context } from './activity';

const ctx: Context = { currency: 'USD', dateFormat: 'iso', inkName: (id) => (id === 'ink_1' ? 'Kon-peki' : undefined) };

describe('change lines', () => {
  it('uses the interface’s words for stored values', () => {
    expect(changeLine('ink', { field: 'sheen', values: ['none', 'high'] }, ctx)).toEqual({
      label: 'Sheen',
      before: { text: 'None' },
      after: { text: 'High' },
    });
    expect(changeLine('ink', { field: 'color_family', values: [null, 'black_grey'] }, ctx).after).toEqual({ text: 'Black & grey' });
    expect(changeLine('ink', { field: 'water_resistance', values: ['none', 'water_resistant'] }, ctx).after).toEqual({
      text: 'Water resistant',
    });
    expect(changeLine('ink', { field: 'base_color', values: ['#112233', '#445566'] }, ctx).after).toEqual({ color: '#445566' });
    expect(changeLine('ink', { field: 'base_types', values: [['dye'], ['dye', 'iron_gall']] }, ctx).after).toEqual({
      text: 'Dye, Iron gall',
    });
  });

  it('names fields without values at the normal level', () => {
    expect(changeLine('pen', { field: 'notes', values: null }, ctx)).toEqual({ label: 'Notes' });
    expect(fieldName('pen', 'filling_systems')).toBe('Filling');
  });

  it('formats prices, dates and linked inks', () => {
    expect(showValue('pen', 'price', 160, ctx)).toEqual({ text: '$160.00' });
    expect(showValue('pen', 'purchased_on', null, ctx)).toEqual({ text: 'None' });
    expect(showValue('swatch', 'sampled_on', '2026-02-11', ctx)).toEqual({ text: '2026-02-11' });
    expect(showValue('swatch', 'ink_id', 'ink_1', ctx)).toEqual({ text: 'Kon-peki' });
    expect(showValue('swatch', 'paper', 'Tomoe River', ctx)).toEqual({ text: 'Tomoe River' });
  });
});

describe('verb', () => {
  it('leads each sentence', () => {
    expect(verb({ subject: 'pen', action: 'reinked' })).toBe('Re-inked');
    expect(verb({ subject: 'swatch', action: 'created' })).toBe('Added a swatch');
  });
});
