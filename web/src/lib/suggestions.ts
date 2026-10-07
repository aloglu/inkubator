/** Who and what to suggest in Ink a pen and the Re-ink menu. */
import type { Collection } from './types/Collection';
import type { Fill } from './types/Fill';
import type { Ink } from './types/Ink';
import type { Pen } from './types/Pen';

/** The parts of the collection the suggestions look at. */
type Data = Pick<Collection, 'pens' | 'inks' | 'fills'>;

/** Open fills by pen id. */
export function openFills(fills: readonly Fill[]): Map<string, Fill> {
  return new Map(fills.filter((fill) => fill.emptied_at === null).map((fill) => [fill.pen_id, fill]));
}

/** When each pen or ink last held or was held, by id; open fills count as now. */
function lastUse(fills: readonly Fill[], key: 'pen_id' | 'ink_id', now: number): Map<string, number> {
  const last = new Map<string, number>();
  for (const fill of fills) {
    const at = fill.emptied_at ?? now;
    if (at > (last.get(fill[key]) ?? -Infinity)) last.set(fill[key], at);
  }
  return last;
}

/** Earlier inks of a pen, most recent first, without repeats and without its current ink. */
export function earlierInks(c: Data, penId: string): { ink: Ink; fill: Fill }[] {
  const inks = new Map(c.inks.map((ink) => [ink.id, ink]));
  const current = openFills(c.fills).get(penId)?.ink_id;
  const seen = new Set(current ? [current] : []);
  const result: { ink: Ink; fill: Fill }[] = [];
  const closed = c.fills
    .filter((fill) => fill.pen_id === penId && fill.emptied_at !== null)
    .sort((a, b) => (b.emptied_at ?? 0) - (a.emptied_at ?? 0));
  for (const fill of closed) {
    const ink = inks.get(fill.ink_id);
    if (!ink || seen.has(ink.id)) continue;
    seen.add(ink.id);
    result.push({ ink, fill });
  }
  return result;
}

/** Inks not in any pen, longest unused first; never-used inks come first of all. */
export function restingInks(c: Data, now: number, exclude: ReadonlySet<string> = new Set()): Ink[] {
  const inUse = new Set([...openFills(c.fills).values()].map((fill) => fill.ink_id));
  const last = lastUse(c.fills, 'ink_id', now);
  return c.inks
    .filter((ink) => !inUse.has(ink.id) && !exclude.has(ink.id))
    .sort((a, b) => (last.get(a.id) ?? -Infinity) - (last.get(b.id) ?? -Infinity));
}

/** Pens without ink, most recently used first; never-used pens last. */
export function restingPens(c: Data, now: number): Pen[] {
  const inked = openFills(c.fills);
  const last = lastUse(c.fills, 'pen_id', now);
  return c.pens
    .filter((pen) => !inked.has(pen.id))
    .sort((a, b) => (last.get(b.id) ?? -Infinity) - (last.get(a.id) ?? -Infinity));
}

/** The pens an ink is in right now (one ink can fill several pens). */
export function pensHolding(c: Data, inkId: string): Pen[] {
  const penIds = new Set(c.fills.filter((f) => f.ink_id === inkId && f.emptied_at === null).map((f) => f.pen_id));
  return c.pens.filter((pen) => penIds.has(pen.id));
}
