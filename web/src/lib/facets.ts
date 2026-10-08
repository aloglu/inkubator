/** The filter facets of each list. */
import { families, familyName, inkFamily } from './color';
import type { Facet } from './filters';
import { flows, kinds, label, waterResistances } from './ink';
import { nibSizes } from './pen';
import type { ColorFamily } from './types/ColorFamily';
import type { Collection } from './types/Collection';
import type { Ink } from './types/Ink';
import type { Pen } from './types/Pen';
import type { Swatch } from './types/Swatch';

/** A representative color for each family, for the filter dots. */
export const familyColors: Record<ColorFamily, string> = {
  red: '#a8323a',
  orange: '#c46a2a',
  yellow: '#d4a72c',
  green: '#3d7a4a',
  teal: '#1e7a78',
  blue: '#2f5f9e',
  purple: '#6a3a8a',
  pink: '#d0559a',
  brown: '#6e4a30',
  black_grey: '#3a3a3e',
};

/** "Converter, Cartridge" counts as both. */
const parts = (value: string) =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

export function penFacets(c: Pick<Collection, 'fills'>): Facet<Pen>[] {
  const inked = new Set(c.fills.filter((f) => f.emptied_at === null).map((f) => f.pen_id));
  return [
    {
      key: 'status',
      label: 'Status',
      style: 'chips',
      values: (pen) => [inked.has(pen.id) ? 'inked' : 'resting'],
      name: (v) => (v === 'inked' ? 'Inked' : 'Resting'),
      order: ['inked', 'resting'],
    },
    { key: 'brand', label: 'Brand', style: 'list', values: (pen) => [pen.brand] },
    { key: 'nib_size', label: 'Nib size', style: 'chips', values: (pen) => [pen.nib_size], order: nibSizes },
    { key: 'nib_material', label: 'Nib material', style: 'chips', values: (pen) => [pen.nib_material] },
    { key: 'filling', label: 'Filling', style: 'chips', values: (pen) => pen.filling_systems },
    { key: 'body', label: 'Body', style: 'chips', values: (pen) => parts(pen.body_material) },
  ];
}

export function inkFacets(c: Pick<Collection, 'fills' | 'swatches'>): Facet<Ink>[] {
  const inUse = new Set(c.fills.filter((f) => f.emptied_at === null).map((f) => f.ink_id));
  const swatched = new Set(c.swatches.map((s) => s.ink_id));
  return [
    {
      key: 'color',
      label: 'Color',
      style: 'colors',
      values: (ink) => [inkFamily(ink)],
      name: (v) => familyName(v as ColorFamily),
      order: families,
    },
    {
      key: 'has',
      label: 'Has',
      style: 'chips',
      values: (ink) => [
        ...(ink.sheen === 'none' ? [] : ['sheen']),
        ...(ink.shimmer === 'none' ? [] : ['shimmer']),
        ...(ink.shading === 'none' ? [] : ['shading']),
      ],
      name: (v) => v[0]!.toUpperCase() + v.slice(1),
      order: ['sheen', 'shimmer', 'shading'],
    },
    {
      key: 'water',
      label: 'Water resistance',
      style: 'chips',
      values: (ink) => [ink.water_resistance],
      name: (v) => label(waterResistances, v as Ink['water_resistance']),
      order: waterResistances.map((o) => o.value),
    },
    {
      key: 'flow',
      label: 'Flow',
      style: 'chips',
      values: (ink) => [ink.flow],
      name: (v) => label(flows, v as Ink['flow']),
      order: flows.map((o) => o.value),
    },
    {
      key: 'in_use',
      label: 'In use',
      style: 'chips',
      values: (ink) => [inUse.has(ink.id) ? 'yes' : 'no'],
      name: (v) => (v === 'yes' ? 'In a pen' : 'Not in a pen'),
      order: ['yes', 'no'],
    },
    {
      key: 'swatch',
      label: 'Swatch',
      style: 'chips',
      values: (ink) => [swatched.has(ink.id) ? 'yes' : 'no'],
      name: (v) => (v === 'yes' ? 'Has a swatch' : 'No swatch yet'),
      order: ['yes', 'no'],
    },
    {
      key: 'kind',
      label: 'Type',
      style: 'chips',
      values: (ink) => [ink.kind],
      name: (v) => label(kinds, v as Ink['kind']),
      order: kinds.map((o) => o.value),
    },
    { key: 'brand', label: 'Brand', style: 'list', values: (ink) => [ink.brand] },
  ];
}

export function swatchFacets(inks: ReadonlyMap<string, Ink>): Facet<Swatch>[] {
  const ink = (swatch: Swatch) => inks.get(swatch.ink_id);
  return [
    {
      key: 'color',
      label: 'Ink color',
      style: 'colors',
      values: (swatch) => {
        const i = ink(swatch);
        return i ? [inkFamily(i)] : [];
      },
      name: (v) => familyName(v as ColorFamily),
      order: families,
    },
    { key: 'paper', label: 'Paper', style: 'list', values: (swatch) => [swatch.paper] },
    { key: 'nib', label: 'Nib', style: 'list', values: (swatch) => [swatch.nib] },
    { key: 'brand', label: 'Ink brand', style: 'list', values: (swatch) => [ink(swatch)?.brand ?? ''] },
  ];
}
