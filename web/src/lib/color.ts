/** Color families used to group and search inks. */
import type { ColorFamily } from './types/ColorFamily';
import type { Ink } from './types/Ink';

/** Shelf order. */
export const families: readonly ColorFamily[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'brown',
  'black_grey',
];

const names: Record<ColorFamily, [one: string, many: string]> = {
  red: ['Red', 'Reds'],
  orange: ['Orange', 'Oranges'],
  yellow: ['Yellow', 'Yellows'],
  green: ['Green', 'Greens'],
  teal: ['Teal', 'Teals'],
  blue: ['Blue', 'Blues'],
  purple: ['Purple', 'Purples'],
  pink: ['Pink', 'Pinks'],
  brown: ['Brown', 'Browns'],
  black_grey: ['Black & grey', 'Blacks & greys'],
};

export const familyName = (family: ColorFamily) => names[family][0];

/** Plural heading for a family on the shelf. */
export const familyHeading = (family: ColorFamily) => names[family][1];

/** Hue (0–360), saturation and lightness (0–1) of a `#rrggbb` color. */
export function hsl(hex: string): { h: number; s: number; l: number } {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s, l };
}

/**
 * The family a color belongs to. Tuned on real collections: muted dark reds
 * and oranges read as browns, dark magentas as purples.
 */
export function colorFamily(hex: string): ColorFamily {
  const { h, s, l } = hsl(hex);
  if (l < 0.13 || s < 0.12 || (s < 0.2 && l < 0.35) || (l < 0.22 && s < 0.35)) return 'black_grey';
  if (h < 15 || h >= 345) return s < 0.3 && l < 0.45 ? 'brown' : l > 0.7 ? 'pink' : 'red';
  if (h < 50 && l < 0.5 && s < 0.6) return 'brown';
  if (h < 42) return 'orange';
  if (h < 66) return l < 0.3 ? 'brown' : 'yellow';
  if (h < 160) return 'green';
  if (h < 190) return 'teal';
  if (h < 255) return 'blue';
  if (h < 320) return l > 0.65 ? 'pink' : 'purple';
  return l < 0.35 ? 'purple' : 'pink';
}

/** An ink's family: the one chosen for it, or else the one its base color suggests. */
export const inkFamily = (ink: Pick<Ink, 'color_family' | 'base_color'>) =>
  ink.color_family ?? colorFamily(ink.base_color);
