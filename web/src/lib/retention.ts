/** What a shorter retention period would remove, by the same rule as core's `apply_retention`. */
import type { Collection } from './types/Collection';
import type { Retention } from './types/Retention';

const DAY = 24 * 60 * 60 * 1000;

export function retentionLoss(
  c: Pick<Collection, 'activity' | 'fills'>,
  retention: Retention,
  now: number,
): { activity: number; fills: number } {
  if (retention.keep === 'forever') return { activity: 0, fills: 0 };
  const cutoff = now - retention.days * DAY;
  return {
    activity: c.activity.filter((entry) => entry.at < cutoff).length,
    fills: c.fills.filter((fill) => fill.emptied_at !== null && fill.emptied_at < cutoff).length,
  };
}

/** Choices offered in Settings; a stored value outside them is shown as well. */
export const retentionChoices: { label: string; retention: Retention }[] = [
  { label: 'Forever', retention: { keep: 'forever' } },
  { label: '30 days', retention: { keep: 'days', days: 30 } },
  { label: '90 days', retention: { keep: 'days', days: 90 } },
  { label: '6 months', retention: { keep: 'days', days: 183 } },
  { label: '1 year', retention: { keep: 'days', days: 365 } },
  { label: '2 years', retention: { keep: 'days', days: 730 } },
  { label: '5 years', retention: { keep: 'days', days: 1826 } },
];

export const retentionKey = (r: Retention) => (r.keep === 'forever' ? 'forever' : String(r.days));
