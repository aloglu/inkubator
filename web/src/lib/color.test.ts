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

describe('colorFamily on real inks', () => {
  it.each([
    ['Oxblood', '#8c5050', 'Brown'],
    ['Honey', '#a07850', 'Brown'],
    ['Zeugma', '#643c28', 'Brown'],
    ['Jet Black', '#503c3c', 'Black & grey'],
    ['Audacious Red', '#a85454', 'Red'],
    ['Thief’s Red', '#c85064', 'Red'],
    ['To-ro', '#ffb43c', 'Orange'],
    ['Inspired Blue', '#14c8f0', 'Blue'],
    ['Ku-jaku', '#14a0a0', 'Teal'],
    ['Sheen Machine', '#642864', 'Purple'],
    ['Yama-budo', '#a0288c', 'Purple'],
    ['Writer’s Blood', '#643c50', 'Purple'],
    ['Tsutsuji', '#c83c8c', 'Pink'],
    ['Hana-ikada', '#f0c8dc', 'Pink'],
  ])('%s (%s) is %s', (_name, hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});
