//! Every change to a collection goes through [`apply`], so the desktop app and the
//! server follow the same rules and record activity the same way.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::model::*;
use crate::new_id;

/// One change requested by the interface.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Command {
    /// Fill an empty pen, or switch an inked pen to a different ink (a re-ink).
    InkPen {
        pen_id: String,
        ink_id: String,
        /// When it happened; defaults to now. Used to record a past inking.
        at: Option<Timestamp>,
        #[serde(default)]
        note: String,
    },
    /// Empty an inked pen.
    FlushPen {
        pen_id: String,
        at: Option<Timestamp>,
    },
    /// Create a pen, or replace the pen with the same id.
    SavePen {
        pen: Pen,
    },
    DeletePen {
        id: String,
    },
    SaveInk {
        ink: Ink,
    },
    DeleteInk {
        id: String,
    },
    SaveSwatch {
        swatch: Swatch,
    },
    DeleteSwatch {
        id: String,
    },
    UpdateSettings {
        settings: Settings,
    },
}

/// What a command changed besides the collection itself.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Outcome {
    /// Photos no longer referenced by anything; the caller may delete or archive them.
    pub unused_images: Vec<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error, Serialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum CommandError {
    #[error("no {kind} with id {id:?}")]
    NotFound { kind: &'static str, id: String },
    #[error("this pen already holds that ink")]
    AlreadyInked,
    #[error("this pen is not inked")]
    NotInked,
    #[error("that ink is in a pen; flush the pen before deleting the ink")]
    InkInUse,
    #[error("the date is earlier than the pen's last change")]
    TooEarly,
}

/// Applies `command` to `collection` at time `now`.
///
/// The collection is only changed when the command succeeds. The result still
/// has to pass [`crate::validate`] before it is stored; [`crate::Store::apply`]
/// does both.
pub fn apply(
    collection: &mut Collection,
    command: Command,
    now: Timestamp,
) -> Result<Outcome, CommandError> {
    let before_images = referenced_images(collection);
    match command {
        Command::InkPen {
            pen_id,
            ink_id,
            at,
            note,
        } => ink_pen(collection, &pen_id, &ink_id, at.unwrap_or(now), note)?,
        Command::FlushPen { pen_id, at } => flush_pen(collection, &pen_id, at.unwrap_or(now))?,
        Command::SavePen { pen } => save_pen(collection, pen, now),
        Command::DeletePen { id } => delete_pen(collection, &id, now)?,
        Command::SaveInk { ink } => save_ink(collection, ink, now),
        Command::DeleteInk { id } => delete_ink(collection, &id, now)?,
        Command::SaveSwatch { swatch } => save_swatch(collection, swatch, now)?,
        Command::DeleteSwatch { id } => delete_swatch(collection, &id, now)?,
        Command::UpdateSettings { settings } => collection.settings = settings,
    }
    let after_images = referenced_images(collection);
    let mut unused_images: Vec<String> = before_images.difference(&after_images).cloned().collect();
    unused_images.sort();
    Ok(Outcome { unused_images })
}

fn referenced_images(c: &Collection) -> HashSet<String> {
    c.pens
        .iter()
        .flat_map(|p| &p.images)
        .chain(c.inks.iter().flat_map(|i| &i.images))
        .chain(c.swatches.iter().flat_map(|s| &s.images))
        .map(|image| image.path.clone())
        .collect()
}

fn pen_label(pen: &Pen) -> String {
    join_name(&pen.brand, &pen.model)
}

fn ink_label(ink: &Ink) -> String {
    join_name(&ink.brand, &ink.name)
}

fn join_name(a: &str, b: &str) -> String {
    [a.trim(), b.trim()]
        .into_iter()
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn find_pen<'a>(c: &'a Collection, id: &str) -> Result<&'a Pen, CommandError> {
    c.pens
        .iter()
        .find(|p| p.id == id)
        .ok_or(CommandError::NotFound {
            kind: "pen",
            id: id.to_string(),
        })
}

fn find_ink<'a>(c: &'a Collection, id: &str) -> Result<&'a Ink, CommandError> {
    c.inks
        .iter()
        .find(|i| i.id == id)
        .ok_or(CommandError::NotFound {
            kind: "ink",
            id: id.to_string(),
        })
}

fn record(c: &mut Collection, entry: ActivityEntry) {
    c.activity.push(entry);
}

fn entry(
    at: Timestamp,
    subject: Subject,
    action: Action,
    id: &str,
    label: String,
) -> ActivityEntry {
    ActivityEntry {
        id: new_id("act"),
        at,
        subject,
        action,
        subject_id: id.to_string(),
        label,
        previous_ink_id: None,
        ink_id: None,
        changes: Vec::new(),
    }
}

/// The latest moment anything happened to this pen's ink.
fn last_ink_change(c: &Collection, pen_id: &str) -> Timestamp {
    c.fills
        .iter()
        .filter(|f| f.pen_id == pen_id)
        .map(|f| f.emptied_at.unwrap_or(f.inked_at))
        .max()
        .unwrap_or(Timestamp::MIN)
}

fn ink_pen(
    c: &mut Collection,
    pen_id: &str,
    ink_id: &str,
    at: Timestamp,
    note: String,
) -> Result<(), CommandError> {
    let label = pen_label(find_pen(c, pen_id)?);
    find_ink(c, ink_id)?;
    if at < last_ink_change(c, pen_id) {
        return Err(CommandError::TooEarly);
    }

    let previous = c
        .fills
        .iter_mut()
        .find(|f| f.pen_id == pen_id && f.emptied_at.is_none());
    let previous_ink_id = match previous {
        Some(fill) if fill.ink_id == ink_id => return Err(CommandError::AlreadyInked),
        Some(fill) => {
            fill.emptied_at = Some(at);
            Some(fill.ink_id.clone())
        }
        None => None,
    };

    c.fills.push(Fill {
        id: new_id("fill"),
        pen_id: pen_id.to_string(),
        ink_id: ink_id.to_string(),
        inked_at: at,
        emptied_at: None,
        note,
    });

    let action = if previous_ink_id.is_some() {
        Action::Reinked
    } else {
        Action::Inked
    };
    let mut e = entry(at, Subject::Pen, action, pen_id, label);
    e.previous_ink_id = previous_ink_id;
    e.ink_id = Some(ink_id.to_string());
    record(c, e);
    Ok(())
}

fn flush_pen(c: &mut Collection, pen_id: &str, at: Timestamp) -> Result<(), CommandError> {
    let label = pen_label(find_pen(c, pen_id)?);
    let fill = c
        .fills
        .iter_mut()
        .find(|f| f.pen_id == pen_id && f.emptied_at.is_none())
        .ok_or(CommandError::NotInked)?;
    if at < fill.inked_at {
        return Err(CommandError::TooEarly);
    }
    fill.emptied_at = Some(at);
    let ink_id = fill.ink_id.clone();

    let mut e = entry(at, Subject::Pen, Action::Flushed, pen_id, label);
    e.previous_ink_id = Some(ink_id);
    record(c, e);
    Ok(())
}

/// Fields compared for activity details, with the words shown to the user.
/// Anything not listed (ids, timestamps) is never reported.
const PEN_FIELDS: &[(&str, &str)] = &[
    ("brand", "brand"),
    ("model", "model"),
    ("color_name", "color"),
    ("colors", "body colors"),
    ("nib_size", "nib size"),
    ("nib_material", "nib material"),
    ("body_material", "body material"),
    ("filling_system", "filling system"),
    ("price", "price"),
    ("purchased_on", "purchase date"),
    ("purchased_from", "bought from"),
    ("notes", "notes"),
    ("notes_public", "note visibility"),
    ("images", "photos"),
];

const INK_FIELDS: &[(&str, &str)] = &[
    ("brand", "brand"),
    ("line", "line"),
    ("name", "name"),
    ("kind", "type"),
    ("volume_ml", "volume"),
    ("amount", "amount"),
    ("price", "price"),
    ("base_color", "color"),
    ("sheen_color", "sheen color"),
    ("shimmer", "shimmer"),
    ("sheen", "sheen"),
    ("shading", "shading"),
    ("water_resistance", "water resistance"),
    ("flow", "flow"),
    ("lubrication", "lubrication"),
    ("dry_time_seconds", "dry time"),
    ("base_types", "base"),
    ("paper", "paper behavior"),
    ("notes", "notes"),
    ("notes_public", "note visibility"),
    ("images", "photos"),
];

const SWATCH_FIELDS: &[(&str, &str)] = &[
    ("ink_id", "ink"),
    ("paper", "paper"),
    ("nib", "nib"),
    ("sampled_on", "date"),
    ("notes", "notes"),
    ("notes_public", "note visibility"),
    ("images", "photos"),
];

/// Describes what changed between two versions of an item: field names, or with
/// detailed activity also old and new values. Photos and notes are named but
/// never quoted. An empty result means nothing worth recording changed.
fn describe_changes<T: Serialize>(
    old: &T,
    new: &T,
    fields: &[(&str, &str)],
    detail: ActivityDetail,
) -> Vec<String> {
    let (old, new) = (
        serde_json::to_value(old).unwrap_or(Value::Null),
        serde_json::to_value(new).unwrap_or(Value::Null),
    );
    fields
        .iter()
        .filter(|(key, _)| old.get(key) != new.get(key))
        .map(|(key, label)| {
            let quotable = !matches!(*key, "images" | "notes");
            if detail == ActivityDetail::Detailed && quotable {
                format!("{label}: {} → {}", show(old.get(key)), show(new.get(key)))
            } else {
                (*label).to_string()
            }
        })
        .collect()
}

/// Brief activity records that an item changed, not what.
fn details(changes: Vec<String>, detail: ActivityDetail) -> Vec<String> {
    if detail == ActivityDetail::Brief {
        Vec::new()
    } else {
        changes
    }
}

fn show(value: Option<&Value>) -> String {
    match value {
        None | Some(Value::Null) => "none".to_string(),
        Some(Value::String(s)) if s.is_empty() => "none".to_string(),
        Some(Value::String(s)) => s.replace('_', " "),
        Some(Value::Array(items)) if items.is_empty() => "none".to_string(),
        Some(Value::Array(items)) => items
            .iter()
            .map(|item| show(Some(item)))
            .collect::<Vec<_>>()
            .join(", "),
        Some(other) => other.to_string(),
    }
}

fn save_pen(c: &mut Collection, mut pen: Pen, now: Timestamp) {
    let settings = c.settings.activity.clone();
    let label = pen_label(&pen);
    match c.pens.iter().position(|p| p.id == pen.id) {
        Some(index) => {
            pen.created_at = c.pens[index].created_at;
            pen.updated_at = now;
            let changes = describe_changes(&c.pens[index], &pen, PEN_FIELDS, settings.detail);
            c.pens[index] = pen;
            if settings.record_pen_changes && !changes.is_empty() {
                let mut e = entry(now, Subject::Pen, Action::Updated, &c.pens[index].id, label);
                e.changes = details(changes, settings.detail);
                record(c, e);
            }
        }
        None => {
            pen.created_at = now;
            pen.updated_at = now;
            let id = pen.id.clone();
            c.pens.push(pen);
            if settings.record_pen_changes {
                record(c, entry(now, Subject::Pen, Action::Created, &id, label));
            }
        }
    }
}

fn delete_pen(c: &mut Collection, id: &str, now: Timestamp) -> Result<(), CommandError> {
    let label = pen_label(find_pen(c, id)?);
    c.pens.retain(|p| p.id != id);
    // Its ink history goes with it.
    c.fills.retain(|f| f.pen_id != id);
    if c.settings.activity.record_deletions {
        record(c, entry(now, Subject::Pen, Action::Deleted, id, label));
    }
    Ok(())
}

fn save_ink(c: &mut Collection, mut ink: Ink, now: Timestamp) {
    let settings = c.settings.activity.clone();
    let label = ink_label(&ink);
    match c.inks.iter().position(|i| i.id == ink.id) {
        Some(index) => {
            ink.created_at = c.inks[index].created_at;
            ink.updated_at = now;
            let changes = describe_changes(&c.inks[index], &ink, INK_FIELDS, settings.detail);
            c.inks[index] = ink;
            if settings.record_ink_changes && !changes.is_empty() {
                let mut e = entry(now, Subject::Ink, Action::Updated, &c.inks[index].id, label);
                e.changes = details(changes, settings.detail);
                record(c, e);
            }
        }
        None => {
            ink.created_at = now;
            ink.updated_at = now;
            let id = ink.id.clone();
            c.inks.push(ink);
            if settings.record_ink_changes {
                record(c, entry(now, Subject::Ink, Action::Created, &id, label));
            }
        }
    }
}

fn delete_ink(c: &mut Collection, id: &str, now: Timestamp) -> Result<(), CommandError> {
    let label = ink_label(find_ink(c, id)?);
    if c.fills
        .iter()
        .any(|f| f.ink_id == id && f.emptied_at.is_none())
    {
        return Err(CommandError::InkInUse);
    }
    c.inks.retain(|i| i.id != id);
    // Its swatches and past fills go with it.
    c.swatches.retain(|s| s.ink_id != id);
    c.fills.retain(|f| f.ink_id != id);
    if c.settings.activity.record_deletions {
        record(c, entry(now, Subject::Ink, Action::Deleted, id, label));
    }
    Ok(())
}

fn save_swatch(c: &mut Collection, mut swatch: Swatch, now: Timestamp) -> Result<(), CommandError> {
    let label = ink_label(find_ink(c, &swatch.ink_id)?);
    let settings = c.settings.activity.clone();
    match c.swatches.iter().position(|s| s.id == swatch.id) {
        Some(index) => {
            swatch.created_at = c.swatches[index].created_at;
            swatch.updated_at = now;
            let changes =
                describe_changes(&c.swatches[index], &swatch, SWATCH_FIELDS, settings.detail);
            c.swatches[index] = swatch;
            if settings.record_swatches && !changes.is_empty() {
                let mut e = entry(
                    now,
                    Subject::Swatch,
                    Action::Updated,
                    &c.swatches[index].id,
                    label,
                );
                e.changes = details(changes, settings.detail);
                record(c, e);
            }
        }
        None => {
            swatch.created_at = now;
            swatch.updated_at = now;
            let id = swatch.id.clone();
            let ink_id = swatch.ink_id.clone();
            c.swatches.push(swatch);
            if settings.record_swatches {
                let mut e = entry(now, Subject::Swatch, Action::Created, &id, label);
                e.ink_id = Some(ink_id);
                record(c, e);
            }
        }
    }
    Ok(())
}

fn delete_swatch(c: &mut Collection, id: &str, now: Timestamp) -> Result<(), CommandError> {
    let swatch = c
        .swatches
        .iter()
        .find(|s| s.id == id)
        .ok_or(CommandError::NotFound {
            kind: "swatch",
            id: id.to_string(),
        })?;
    let ink_id = swatch.ink_id.clone();
    let label = c
        .inks
        .iter()
        .find(|i| i.id == ink_id)
        .map(ink_label)
        .unwrap_or_default();
    c.swatches.retain(|s| s.id != id);
    if c.settings.activity.record_deletions {
        let mut e = entry(now, Subject::Swatch, Action::Deleted, id, label);
        e.ink_id = Some(ink_id);
        record(c, e);
    }
    Ok(())
}
