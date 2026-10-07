/** Figures for the Stats screen, all derived from the collection's fills and prices. */
import { daysBetween } from './format';
import type { Collection } from './types/Collection';
import type { Fill } from './types/Fill';
import type { Ink } from './types/Ink';
import type { Pen } from './types/Pen';

const DAY = 24 * 60 * 60 * 1000;

export type Range = 30 | 90 | 365 | 'all';

/** Start of the period shown: N days back, or the first recorded fill. */
export function rangeStart(range: Range, fills: readonly Fill[], now: number): number {
  if (range !== 'all') return now - range * DAY;
  const first = Math.min(...fills.map((f) => f.inked_at));
  return Number.isFinite(first) ? first : now - 30 * DAY;
}

export type Segment = { fill: Fill; ink: Ink | undefined; start: number; end: number; open: boolean };
export type RotationRow = { pen: Pen; segments: Segment[] };

/** Each pen that held ink during the period, with its fills clipped to it; most recently used pens first. */
export function rotation(c: Pick<Collection, 'pens' | 'inks' | 'fills'>, from: number, now: number): RotationRow[] {
  const inks = new Map(c.inks.map((ink) => [ink.id, ink]));
  const rows = new Map<string, Segment[]>();
  for (const fill of c.fills) {
    const end = Math.min(fill.emptied_at ?? now, now);
    if (end < from || fill.inked_at > now) continue;
    const segment = { fill, ink: inks.get(fill.ink_id), start: Math.max(fill.inked_at, from), end, open: fill.emptied_at === null };
    rows.set(fill.pen_id, [...(rows.get(fill.pen_id) ?? []), segment]);
  }
  return c.pens
    .filter((pen) => rows.has(pen.id))
    .map((pen) => ({ pen, segments: rows.get(pen.id)!.sort((a, b) => a.start - b.start) }))
    .sort((a, b) => Math.max(...b.segments.map((s) => s.end)) - Math.max(...a.segments.map((s) => s.end)));
}

export type Headline = {
  inked: number;
  pens: number;
  /** Average days per finished fill that ended in the period; null when none did. */
  averageFill: number | null;
  swatched: number;
  inks: number;
  /** Pens plus inks (price × amount); null when nothing has a price. */
  spend: number | null;
};

export function headline(c: Pick<Collection, 'pens' | 'inks' | 'fills' | 'swatches'>, from: number, now: number): Headline {
  const finished = c.fills.filter((f) => f.emptied_at !== null && f.emptied_at >= from && f.emptied_at <= now);
  const swatched = new Set(c.swatches.map((s) => s.ink_id));
  const prices = [
    ...c.pens.map((p) => p.price),
    ...c.inks.map((i) => (i.price === null ? null : i.price * Math.max(1, i.amount))),
  ].filter((v): v is number => v !== null);
  return {
    inked: c.fills.filter((f) => f.emptied_at === null).length,
    pens: c.pens.length,
    averageFill: finished.length
      ? Math.round(finished.reduce((sum, f) => sum + daysBetween(f.inked_at, f.emptied_at!), 0) / finished.length)
      : null,
    swatched: c.inks.filter((i) => swatched.has(i.id)).length,
    inks: c.inks.length,
    spend: prices.length ? prices.reduce((a, b) => a + b, 0) : null,
  };
}

/** Totals per brand, largest first. */
export function byBrand<T extends { brand: string }>(items: readonly T[], value: (item: T) => number | null): { brand: string; value: number }[] {
  const totals = new Map<string, number>();
  for (const item of items) {
    const v = value(item);
    if (v === null) continue;
    const brand = item.brand || 'No brand';
    totals.set(brand, (totals.get(brand) ?? 0) + v);
  }
  return [...totals]
    .map(([brand, total]) => ({ brand, value: total }))
    .sort((a, b) => b.value - a.value || a.brand.localeCompare(b.brand));
}
