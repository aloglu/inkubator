//! Pruning old history according to the user's retention setting.
//!
//! Activity and finished fills share one limit: choosing to forget activity after
//! N days also forgets which inks were in which pens before that. Open fills (the
//! pens' current inks) are never pruned.

use crate::model::{Collection, Retention, Timestamp};

const DAY_MS: i64 = 24 * 60 * 60 * 1000;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Pruned {
    pub activity: usize,
    pub fills: usize,
}

/// Removes activity entries and finished fills older than the retention limit.
pub fn apply_retention(collection: &mut Collection, now: Timestamp) -> Pruned {
    let Retention::Days(days) = collection.settings.activity.retention else {
        return Pruned::default();
    };
    let cutoff = now.saturating_sub(i64::from(days).saturating_mul(DAY_MS));

    let activity_before = collection.activity.len();
    collection.activity.retain(|entry| entry.at >= cutoff);

    let fills_before = collection.fills.len();
    collection
        .fills
        .retain(|fill| fill.emptied_at.is_none_or(|emptied| emptied >= cutoff));

    Pruned {
        activity: activity_before - collection.activity.len(),
        fills: fills_before - collection.fills.len(),
    }
}
