/** Dates and labels as shown in the interface. */
import type { DateFormat } from './types/DateFormat';
import type { Ink } from './types/Ink';
import type { Pen } from './types/Pen';

const DAY = 24 * 60 * 60 * 1000;

const locales: Record<DateFormat, string | undefined> = {
  system: undefined,
  us: 'en-US',
  eu: 'en-GB',
  iso: 'sv-SE',
};

/** "6 Oct 2026", "Oct 6, 2026" or "2026-10-06"; the year is left out for this year when `short`. */
export function formatDate(ms: number, format: DateFormat, { short = false } = {}): string {
  const date = new Date(ms);
  if (format === 'iso') return date.toLocaleDateString('sv-SE');
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(locales[format], {
    day: 'numeric',
    month: 'short',
    year: short && sameYear ? undefined : 'numeric',
  });
}

/** "Tuesday, 6 October" for page headings. */
export function formatLongDay(ms: number, format: DateFormat): string {
  return new Date(ms).toLocaleDateString(format === 'iso' ? 'en-GB' : locales[format], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Start of the local calendar day containing `ms`. */
export function startOfDay(ms: number): number {
  const date = new Date(ms);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/** Whole calendar days from `from` to `to` (local time), never negative. */
export function daysBetween(from: number, to: number): number {
  return Math.max(0, Math.round((startOfDay(to) - startOfDay(from)) / DAY));
}

/** `YYYY-MM-DD` for a date input, in local time. */
export function toDateInput(ms: number): string {
  const date = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a date input's `YYYY-MM-DD` as local noon, so time zones never move it to another day. */
export function fromDateInput(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime();
}

export const penName = (pen: Pick<Pen, 'brand' | 'model'>) => [pen.brand, pen.model].filter(Boolean).join(' ');

/** "Pilot · Iroshizuku", or just the brand. */
export const inkMaker = (ink: Pick<Ink, 'brand' | 'line'>) => [ink.brand, ink.line].filter(Boolean).join(' · ');

/** "Pilot · F · 14k gold". */
export const penDetails = (pen: Pick<Pen, 'brand' | 'nib_size' | 'nib_material'>) =>
  [pen.brand, pen.nib_size, pen.nib_material].filter(Boolean).join(' · ');

export const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
