import { describe, expect, it } from 'vitest';
import { daysBetween, formatDate, fromDateInput, inkMaker, penDetails, toDateInput } from './format';

describe('dates', () => {
  it('counts calendar days, not 24-hour periods', () => {
    const lateEvening = new Date(2026, 9, 6, 23, 30).getTime();
    const nextMorning = new Date(2026, 9, 7, 8, 0).getTime();
    expect(daysBetween(lateEvening, nextMorning)).toBe(1);
    expect(daysBetween(nextMorning, nextMorning)).toBe(0);
    expect(daysBetween(nextMorning, lateEvening)).toBe(0);
  });

  it('round-trips date inputs at local noon', () => {
    const ms = fromDateInput('2026-03-09');
    expect(ms).not.toBeNull();
    expect(new Date(ms!).getHours()).toBe(12);
    expect(toDateInput(ms!)).toBe('2026-03-09');
    expect(fromDateInput('9 March')).toBeNull();
  });

  it('formats dates in the chosen style', () => {
    const ms = new Date(2025, 2, 9, 12).getTime();
    expect(formatDate(ms, 'iso')).toBe('2025-03-09');
    expect(formatDate(ms, 'eu')).toBe('9 Mar 2025');
    expect(formatDate(ms, 'us')).toBe('Mar 9, 2025');
  });
});

describe('labels', () => {
  it('skips empty parts', () => {
    expect(inkMaker({ brand: 'Pilot', line: 'Iroshizuku' })).toBe('Pilot · Iroshizuku');
    expect(inkMaker({ brand: 'Diamine', line: '' })).toBe('Diamine');
    expect(penDetails({ brand: 'Lamy', nib_size: 'F', nib_material: '' })).toBe('Lamy · F');
  });
});
