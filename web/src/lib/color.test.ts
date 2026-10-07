import { describe, expect, it } from 'vitest';
import { colorFamily, familyHeading, inkFamily } from './color';

describe('colorFamily', () => {
  it.each([
    ['#1f3a5f', 'blue'],
    ['#1b6fae', 'blue'],
    ['#7a1f2b', 'red'],
    ['#2f6b4f', 'green'],
    ['#1e6b6e', 'teal'],
    ['#d9a400', 'yellow'],
    ['#c0602a', 'orange'],
    ['#5a3a1e', 'brown'],
    ['#6a3a8a', 'purple'],
    ['#e07aa8', 'pink'],
    ['#2a2a2e', 'black_grey'],
    ['#808080', 'black_grey'],
  ])('%s is %s', (hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});

describe('colorFamily on real inks', () => {
  it.each([
    ['Oxblood', '#8c5050', 'brown'],
    ['Honey', '#a07850', 'brown'],
    ['Zeugma', '#643c28', 'brown'],
    ['Jet Black', '#503c3c', 'black_grey'],
    ['Audacious Red', '#a85454', 'red'],
    ['Thief’s Red', '#c85064', 'red'],
    ['To-ro', '#ffb43c', 'orange'],
    ['Inspired Blue', '#14c8f0', 'blue'],
    ['Ku-jaku', '#14a0a0', 'teal'],
    ['Sheen Machine', '#642864', 'purple'],
    ['Yama-budo', '#a0288c', 'purple'],
    ['Writer’s Blood', '#643c50', 'purple'],
    ['Tsutsuji', '#c83c8c', 'pink'],
    ['Hana-ikada', '#f0c8dc', 'pink'],
  ])('%s (%s) is %s', (_name, hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});

describe('inkFamily', () => {
  it('uses the chosen family over the color', () => {
    expect(inkFamily({ base_color: '#503c3c', color_family: null })).toBe('black_grey');
    expect(inkFamily({ base_color: '#503c3c', color_family: 'brown' })).toBe('brown');
    expect(familyHeading('black_grey')).toBe('Blacks & greys');
  });
});
