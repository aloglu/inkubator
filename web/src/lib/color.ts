/** Color families used to group and search inks. */

export const families = [
  'Red',
  'Orange',
  'Yellow',
  'Green',
  'Teal',
  'Blue',
  'Purple',
  'Pink',
  'Brown',
  'Black & grey',
] as const;
export type ColorFamily = (typeof families)[number];

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
 * The family an ink's base color belongs to. Tuned on real collections: muted
 * dark reds and oranges read as browns, dark magentas as purples.
 */
export function colorFamily(hex: string): ColorFamily {
  const { h, s, l } = hsl(hex);
  if (l < 0.13 || s < 0.12 || (s < 0.2 && l < 0.35) || (l < 0.22 && s < 0.35)) return 'Black & grey';
  if (h < 15 || h >= 345) return s < 0.3 && l < 0.45 ? 'Brown' : l > 0.7 ? 'Pink' : 'Red';
  if (h < 50 && l < 0.5 && s < 0.6) return 'Brown';
  if (h < 42) return 'Orange';
  if (h < 66) return l < 0.3 ? 'Brown' : 'Yellow';
  if (h < 160) return 'Green';
  if (h < 190) return 'Teal';
  if (h < 255) return 'Blue';
  if (h < 320) return l > 0.65 ? 'Pink' : 'Purple';
  return l < 0.35 ? 'Purple' : 'Pink';
}

/** Plural heading for a family on the shelf. */
export const familyHeading = (family: ColorFamily) => (family === 'Black & grey' ? 'Blacks & greys' : `${family}s`);
