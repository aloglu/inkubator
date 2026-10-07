import { describe, expect, it } from 'vitest';
import { retentionLoss } from './retention';
import { DAY, fill } from './test-data';
import type { ActivityEntry } from './types/ActivityEntry';

const entry = (day: number): ActivityEntry => ({
  id: `a${day}`, at: day * DAY, subject: 'pen', action: 'inked', subject_id: 'p', label: 'P',
  previous_ink_id: null, ink_id: null, changes: [],
});

describe('retentionLoss', () => {
  it('counts activity and finished fills past the limit, never open fills', () => {
    const c = {
      activity: [entry(1), entry(50), entry(95)],
      fills: [fill('p', 'a', 1, 5), fill('p', 'b', 5, 60), fill('q', 'c', 2, null)],
    };
    expect(retentionLoss(c, { keep: 'forever' }, 100 * DAY)).toEqual({ activity: 0, fills: 0 });
    expect(retentionLoss(c, { keep: 'days', days: 30 }, 100 * DAY)).toEqual({ activity: 2, fills: 2 });
    expect(retentionLoss(c, { keep: 'days', days: 90 }, 100 * DAY)).toEqual({ activity: 1, fills: 1 });
  });
});
