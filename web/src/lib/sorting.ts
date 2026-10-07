/** Sort orders for the lists, shared with the showcase (same values as its settings). */
import { families, inkFamily } from './color';
import { hueKey } from './ink';
import type { Fill } from './types/Fill';
import type { Ink } from './types/Ink';
import type { InkSort } from './types/InkSort';
import type { Pen } from './types/Pen';
import type { PenSort } from './types/PenSort';
import type { Swatch } from './types/Swatch';
import type { SwatchSort } from './types/SwatchSort';

type Options<T extends string> = readonly { value: T; label: string }[];

export const penSorts: Options<PenSort> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'brand', label: 'Brand' },
  { value: 'model', label: 'Model' },
  { value: 'last_inked', label: 'Last inked' },
  { value: 'price', label: 'Price' },
];

export const inkSorts: Options<InkSort> = [
  { value: 'hue', label: 'By hue' },
  { value: 'name', label: 'Name' },
  { value: 'brand', label: 'Brand' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

export const swatchSorts: Options<SwatchSort> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'ink', label: 'Ink' },
  { value: 'paper', label: 'Paper' },
];

const text = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });

export function sortPens(pens: readonly Pen[], sort: PenSort, fills: readonly Fill[]): Pen[] {
  const lastInked = new Map<string, number>();
  for (const fill of fills) lastInked.set(fill.pen_id, Math.max(lastInked.get(fill.pen_id) ?? 0, fill.inked_at));
  const compare: Record<PenSort, (a: Pen, b: Pen) => number> = {
    newest: (a, b) => b.created_at - a.created_at,
    oldest: (a, b) => a.created_at - b.created_at,
    brand: (a, b) => text(a.brand, b.brand) || text(a.model, b.model),
    model: (a, b) => text(a.model, b.model) || text(a.brand, b.brand),
    // Pens never inked go last.
    last_inked: (a, b) => (lastInked.get(b.id) ?? -1) - (lastInked.get(a.id) ?? -1),
    // Highest first; pens without a price go last.
    price: (a, b) => (b.price ?? -1) - (a.price ?? -1),
  };
  return [...pens].sort((a, b) => compare[sort](a, b) || b.created_at - a.created_at);
}

export function sortInks(inks: readonly Ink[], sort: InkSort): Ink[] {
  const family = (ink: Ink) => families.indexOf(inkFamily(ink));
  const compare: Record<InkSort, (a: Ink, b: Ink) => number> = {
    hue: (a, b) => family(a) - family(b) || hueKey(a.base_color) - hueKey(b.base_color),
    name: (a, b) => text(a.name, b.name),
    brand: (a, b) => text(a.brand, b.brand) || text(a.line, b.line) || text(a.name, b.name),
    newest: (a, b) => b.created_at - a.created_at,
    oldest: (a, b) => a.created_at - b.created_at,
  };
  return [...inks].sort((a, b) => compare[sort](a, b) || text(a.name, b.name));
}

export function sortSwatches(swatches: readonly Swatch[], sort: SwatchSort, inks: ReadonlyMap<string, Ink>): Swatch[] {
  const inkName = (swatch: Swatch) => inks.get(swatch.ink_id)?.name ?? '';
  const compare: Record<SwatchSort, (a: Swatch, b: Swatch) => number> = {
    newest: (a, b) => b.created_at - a.created_at,
    oldest: (a, b) => a.created_at - b.created_at,
    ink: (a, b) => text(inkName(a), inkName(b)),
    // Swatches without a paper go last.
    paper: (a, b) => (!a.paper ? 1 : 0) - (!b.paper ? 1 : 0) || text(a.paper, b.paper) || text(inkName(a), inkName(b)),
  };
  return [...swatches].sort((a, b) => compare[sort](a, b) || b.created_at - a.created_at);
}
