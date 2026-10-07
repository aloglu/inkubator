//! What the public showcase may see.
//!
//! [`project`] builds the visitor's view from the full collection according to
//! the showcase settings. Anything not copied here never leaves the server:
//! hidden sections, prices (unless enabled), where a pen was bought, fill notes,
//! activity names and details, and every setting except display ones.

use std::collections::HashSet;

use serde::Serialize;

use crate::model::*;

/// Entries shown when only recent activity is public.
pub const RECENT_ACTIVITY_LIMIT: usize = 5;

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PublicCollection {
    pub title: String,
    pub theme: Theme,
    pub date_format: DateFormat,
    /// Only present when prices are shown.
    pub currency: Option<String>,
    pub show_stats: bool,
    pub show_charts: bool,
    pub show_activity_filters: bool,
    pub pen_sort: PenSort,
    pub ink_sort: InkSort,
    pub swatch_sort: SwatchSort,
    pub pens: Vec<Pen>,
    pub inks: Vec<Ink>,
    pub swatches: Vec<Swatch>,
    pub fills: Vec<Fill>,
    pub activity: Vec<PublicActivity>,
}

/// An activity entry stripped to what happened, when, and to which visible item.
#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct PublicActivity {
    pub at: Timestamp,
    pub subject: Subject,
    pub action: Action,
    /// Empty when the item is not visible (or no longer exists).
    pub subject_id: String,
    /// The ink involved, when inks are visible.
    pub ink_id: Option<String>,
}

impl PublicCollection {
    /// Photos a visitor may load.
    pub fn photo_paths(&self) -> HashSet<&str> {
        self.pens
            .iter()
            .flat_map(|p| &p.images)
            .chain(self.inks.iter().flat_map(|i| &i.images))
            .chain(self.swatches.iter().flat_map(|s| &s.images))
            .map(|image| image.path.as_str())
            .collect()
    }
}

pub fn project(c: &Collection) -> PublicCollection {
    let s = &c.settings.showcase;
    let show_pens = s.show_pens;
    let show_inks = s.show_inks;
    // Swatches only make sense next to their inks.
    let show_swatches = s.show_swatches && show_inks;

    let pens: Vec<Pen> = if show_pens {
        c.pens
            .iter()
            .cloned()
            .map(|mut pen| {
                if !s.show_prices {
                    pen.price = None;
                    pen.purchased_from.clear();
                }
                pen
            })
            .collect()
    } else {
        Vec::new()
    };
    let inks: Vec<Ink> = if show_inks {
        c.inks
            .iter()
            .cloned()
            .map(|mut ink| {
                if !s.show_prices {
                    ink.price = None;
                }
                ink
            })
            .collect()
    } else {
        Vec::new()
    };
    let swatches: Vec<Swatch> = if show_swatches {
        c.swatches.clone()
    } else {
        Vec::new()
    };

    let pen_ids: HashSet<&str> = pens.iter().map(|p| p.id.as_str()).collect();
    let ink_ids: HashSet<&str> = inks.iter().map(|i| i.id.as_str()).collect();
    let swatch_ids: HashSet<&str> = swatches.iter().map(|s| s.id.as_str()).collect();

    // Which ink was in which pen is only shown when both are visible.
    let fills: Vec<Fill> = c
        .fills
        .iter()
        .filter(|f| pen_ids.contains(f.pen_id.as_str()) && ink_ids.contains(f.ink_id.as_str()))
        .cloned()
        .map(|mut fill| {
            fill.note.clear();
            fill
        })
        .collect();

    let mut activity: Vec<PublicActivity> = if s.show_activity || s.show_recent_activity {
        c.activity
            .iter()
            .filter(|e| match e.subject {
                Subject::Pen => show_pens,
                Subject::Ink => show_inks,
                Subject::Swatch => show_swatches,
            })
            .filter(|e| {
                let about_inking =
                    matches!(e.action, Action::Inked | Action::Reinked | Action::Flushed);
                !about_inking || show_inks
            })
            .map(|e| {
                let visible = match e.subject {
                    Subject::Pen => pen_ids.contains(e.subject_id.as_str()),
                    Subject::Ink => ink_ids.contains(e.subject_id.as_str()),
                    Subject::Swatch => swatch_ids.contains(e.subject_id.as_str()),
                };
                PublicActivity {
                    at: e.at,
                    subject: e.subject,
                    action: e.action,
                    subject_id: if visible {
                        e.subject_id.clone()
                    } else {
                        String::new()
                    },
                    ink_id: e.ink_id.clone().filter(|id| ink_ids.contains(id.as_str())),
                }
            })
            .collect()
    } else {
        Vec::new()
    };
    activity.sort_by_key(|e| std::cmp::Reverse(e.at));
    if !s.show_activity {
        activity.truncate(RECENT_ACTIVITY_LIMIT);
    }

    PublicCollection {
        title: s.title.clone(),
        theme: s.theme,
        date_format: c.settings.defaults.date_format,
        currency: s.show_prices.then(|| c.settings.defaults.currency.clone()),
        show_stats: s.show_stats,
        show_charts: s.show_charts,
        show_activity_filters: s.show_activity_filters,
        pen_sort: s.pen_sort,
        ink_sort: s.ink_sort,
        swatch_sort: s.swatch_sort,
        pens,
        inks,
        swatches,
        fills,
        activity,
    }
}
