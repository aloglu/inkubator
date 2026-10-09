/**
 * Visitors see the same screens as the owner, fed by the public view. This
 * turns that view into the collection shape the screens read. Anything the
 * server did not send gets a neutral value; editing is blocked elsewhere.
 */
import type { Collection } from './types/Collection';
import type { PublicCollection } from './types/PublicCollection';

export function visitorCollection(p: PublicCollection): Collection {
  return {
    schema_version: 3,
    pens: p.pens,
    inks: p.inks,
    swatches: p.swatches,
    fills: p.fills,
    activity: p.activity.map((entry, index) => ({
      id: `public_${index}`,
      at: entry.at,
      subject: entry.subject,
      action: entry.action,
      subject_id: entry.subject_id,
      label: '',
      previous_ink_id: entry.previous_ink_id,
      ink_id: entry.ink_id,
      changes: [],
    })),
    settings: {
      theme: p.theme,
      open_items_in_edit_mode: false,
      confirm_destructive_actions: true,
      activity: {
        retention: { keep: 'forever' },
        detail: 'brief',
        record_pen_changes: true,
        record_ink_changes: true,
        record_swatches: true,
        record_deletions: true,
      },
      defaults: {
        currency: p.currency ?? 'USD',
        date_format: p.date_format,
        nib_size: '',
        nib_material: '',
        ink_kind: 'bottle',
      },
      backups: { frequency: 'off', keep: 1, keep_replaced_photos: false, validate_on_import: true },
      showcase: {
        enabled: true,
        title: p.title,
        theme: p.theme,
        show_pens: p.show_pens,
        show_inks: p.show_inks,
        show_swatches: p.show_swatches,
        show_prices: p.currency !== null,
        // The server already left out what visitors may not see.
        show_purchase_dates: true,
        show_purchased_from: true,
        show_notes: true,
        show_stats: p.show_stats,
        show_charts: p.show_charts,
        show_activity: p.show_activity,
        show_activity_filters: p.show_activity_filters,
        show_recent_activity: p.show_recent_activity,
        pen_sort: p.pen_sort,
        ink_sort: p.ink_sort,
        swatch_sort: p.swatch_sort,
      },
      stats: { default_range: p.stats_range },
      check_for_updates: false,
    },
  };
}
