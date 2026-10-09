//! One-time conversion of an Inkubator 2.x data folder into a 3.0 collection.
//!
//! Reads `data.json` and `preferences.json` from the old folder, converts every
//! item, rebuilds ink history (fills) from the activity log and the pens that are
//! currently inked, and copies the photos that are still referenced. The old
//! folder is only read, never changed.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use serde_json::{Map, Value};

use crate::images::{is_managed_image_path, ImageSection};
use crate::model::*;
use crate::new_id;
use crate::storage::{Store, StoreError, EMPTY_REVISION};

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("could not read {path}: {source}")]
    Read { path: PathBuf, source: io::Error },
    #[error("{path} is not valid JSON: {source}")]
    Json {
        path: PathBuf,
        source: serde_json::Error,
    },
    #[error("{path} does not look like Inkubator 2.x data (expected a JSON object)")]
    NotAnObject { path: PathBuf },
    #[error("the destination already holds a 3.0 collection; import only into an empty folder")]
    DestinationNotEmpty,
    #[error("could not copy photo {path}: {source}")]
    CopyImage { path: PathBuf, source: io::Error },
    #[error(transparent)]
    Store(#[from] StoreError),
}

/// What an import produced, with anything that had to be adjusted or skipped.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct ImportReport {
    pub pens: usize,
    pub inks: usize,
    pub swatches: usize,
    pub fills: usize,
    pub open_fills: usize,
    pub activity: usize,
    pub images: usize,
    pub warnings: Vec<String>,
}

/// A converted collection plus the photos it references, before anything is written.
#[derive(Clone, Debug)]
pub struct Converted {
    pub collection: Collection,
    /// Image paths (relative to `images/`) to copy from the old folder.
    pub images: Vec<String>,
    pub warnings: Vec<String>,
}

/// Converts the 2.x folder at `from` and writes the result into `store`, which
/// must not hold a collection yet. `now` is used for items with no known
/// creation time.
pub fn import(from: &Path, store: &Store, now: Timestamp) -> Result<ImportReport, ImportError> {
    if store.load()?.revision != EMPTY_REVISION {
        return Err(ImportError::DestinationNotEmpty);
    }

    let data = read_object(&from.join("data.json"))?;
    let preferences = match read_object(&from.join("preferences.json")) {
        Ok(preferences) => preferences,
        Err(ImportError::Read { source, .. }) if source.kind() == io::ErrorKind::NotFound => {
            Map::new()
        }
        Err(error) => return Err(error),
    };

    let old_images = from.join("images");
    let mut converted = convert(&data, &preferences, now, |path| {
        fs::symlink_metadata(old_images.join(path)).is_ok_and(|meta| meta.file_type().is_file())
    });

    for path in &converted.images {
        copy_image(&old_images.join(path), &store.images_dir().join(path))?;
    }
    store.save(&converted.collection, EMPTY_REVISION)?;

    let c = &converted.collection;
    Ok(ImportReport {
        pens: c.pens.len(),
        inks: c.inks.len(),
        swatches: c.swatches.len(),
        fills: c.fills.len(),
        open_fills: c.fills.iter().filter(|f| f.emptied_at.is_none()).count(),
        activity: c.activity.len(),
        images: converted.images.len(),
        warnings: std::mem::take(&mut converted.warnings),
    })
}

fn read_object(path: &Path) -> Result<Map<String, Value>, ImportError> {
    let bytes = fs::read(path).map_err(|source| ImportError::Read {
        path: path.to_path_buf(),
        source,
    })?;
    match serde_json::from_slice(&bytes) {
        Ok(Value::Object(map)) => Ok(map),
        Ok(_) => Err(ImportError::NotAnObject {
            path: path.to_path_buf(),
        }),
        Err(source) => Err(ImportError::Json {
            path: path.to_path_buf(),
            source,
        }),
    }
}

fn copy_image(source: &Path, destination: &Path) -> Result<(), ImportError> {
    let err = |source| ImportError::CopyImage {
        path: destination.to_path_buf(),
        source,
    };
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(err)?;
    }
    let bytes = fs::read(source).map_err(err)?;
    crate::storage::atomic_write(destination, &bytes).map_err(|error| match error {
        StoreError::Io { source, .. } => err(source),
        other => err(io::Error::other(other.to_string())),
    })
}

/// Pure conversion. `image_exists` reports whether a photo path (relative to the
/// old `images/` folder) is present; missing photos are dropped with a warning.
pub fn convert(
    data: &Map<String, Value>,
    preferences: &Map<String, Value>,
    now: Timestamp,
    image_exists: impl Fn(&str) -> bool,
) -> Converted {
    let mut cx = Context {
        warnings: Vec::new(),
        images: Vec::new(),
        image_exists: &image_exists,
        seen_ids: HashSet::new(),
    };

    let activity_raw = array(data, "activity_log");
    let times = EntityTimes::from_activity(activity_raw);

    let pens_raw = array(data, "pens");
    let pens: Vec<Pen> = pens_raw
        .iter()
        .enumerate()
        .filter_map(|(n, raw)| cx.pen(raw, &times, fallback_time(now, n, pens_raw.len())))
        .collect();

    let inks_raw = array(data, "inks");
    let inks: Vec<Ink> = inks_raw
        .iter()
        .enumerate()
        .filter_map(|(n, raw)| cx.ink(raw, &times, fallback_time(now, n, inks_raw.len())))
        .collect();

    let ink_ids: HashSet<&str> = inks.iter().map(|i| i.id.as_str()).collect();
    let pen_ids: HashSet<&str> = pens.iter().map(|p| p.id.as_str()).collect();

    let swatches_raw = array(data, "swatches");
    let swatches: Vec<Swatch> = swatches_raw
        .iter()
        .enumerate()
        .filter_map(|(n, raw)| cx.swatch(raw, &ink_ids, fallback_time(now, n, swatches_raw.len())))
        .collect();

    let fills = cx.fills(
        activity_raw,
        array(data, "currently_inked"),
        &pen_ids,
        &ink_ids,
    );
    let activity = cx.activity(activity_raw, &pens, &inks);
    let settings = settings(preferences, data);

    Converted {
        collection: Collection {
            schema_version: SCHEMA_VERSION,
            pens,
            inks,
            swatches,
            fills,
            activity,
            settings,
        },
        images: cx.images,
        warnings: cx.warnings,
    }
}

/// Creation time for items with no recorded one: just before `now`, keeping
/// the old list order (earlier in the list = older).
fn fallback_time(now: Timestamp, index: usize, len: usize) -> Timestamp {
    now - (len - index) as i64
}

struct Context<'a> {
    warnings: Vec<String>,
    images: Vec<String>,
    image_exists: &'a dyn Fn(&str) -> bool,
    seen_ids: HashSet<String>,
}

impl Context<'_> {
    fn warn(&mut self, message: impl Into<String>) {
        self.warnings.push(message.into());
    }

    /// Keeps the old id when it is usable and unique, otherwise makes a new one.
    fn id(&mut self, raw: &Map<String, Value>, prefix: &str, label: &str) -> String {
        let old = text(raw, "id");
        if !old.is_empty() && self.seen_ids.insert(old.clone()) {
            return old;
        }
        let fresh = new_id(prefix);
        self.seen_ids.insert(fresh.clone());
        if !old.is_empty() {
            self.warn(format!("{label}: duplicate id {old:?} replaced"));
        }
        fresh
    }

    fn pen(&mut self, raw: &Value, times: &EntityTimes, fallback: Timestamp) -> Option<Pen> {
        let raw = raw.as_object()?;
        let brand = text(raw, "brand");
        let model = text(raw, "model");
        let label = display_name(&[&brand, &model], "Pen");
        if brand.is_empty() && model.is_empty() {
            self.warn("Skipped a pen with neither brand nor model");
            return None;
        }
        let id = self.id(raw, "pen", &label);

        let mut colors: Vec<String> = array(raw, "hex_colors")
            .iter()
            .filter_map(|c| c.as_str().and_then(normalize_hex))
            .collect();
        if colors.is_empty() {
            colors.extend(
                raw.get("hex_color")
                    .and_then(Value::as_str)
                    .and_then(normalize_hex),
            );
        }
        colors.dedup();

        let price = self.number(raw, "price", &label);
        let images = self.images(raw, ImageSection::Pens, &label);
        let (created_at, updated_at) = times.span(&id, fallback);

        Some(Pen {
            id,
            brand,
            model,
            color_name: text(raw, "color"),
            colors,
            nib_size: text(raw, "nib"),
            nib_material: text(raw, "nib_material"),
            body_material: text(raw, "material"),
            filling_systems: filling_systems(&text(raw, "filling_system")),
            price,
            purchased_on: None,
            purchased_from: String::new(),
            notes: text(raw, "notes"),
            notes_public: false,
            images,
            created_at,
            updated_at,
        })
    }

    fn ink(&mut self, raw: &Value, times: &EntityTimes, fallback: Timestamp) -> Option<Ink> {
        let raw = raw.as_object()?;
        let brand = text(raw, "brand");
        let mut name = text(raw, "name");
        let label = display_name(&[&brand, &name], "Ink");
        if name.is_empty() {
            if brand.is_empty() {
                self.warn("Skipped an ink with no name or brand");
                return None;
            }
            self.warn(format!("{label}: ink had no name; named \"Unnamed ink\""));
            name = "Unnamed ink".to_string();
        }
        let id = self.id(raw, "ink", &label);

        let hex_colors: Vec<String> = array(raw, "hex_colors")
            .iter()
            .filter_map(|c| c.as_str().and_then(normalize_hex))
            .collect();
        let base_color = raw
            .get("color_base")
            .and_then(Value::as_str)
            .and_then(normalize_hex)
            .or_else(|| hex_colors.first().cloned())
            .unwrap_or_else(|| {
                self.warn(format!("{label}: no valid color; set to dark grey"));
                "#444444".to_string()
            });
        let sheen_color = raw
            .get("color_accent")
            .and_then(Value::as_str)
            .and_then(normalize_hex)
            .filter(|accent| *accent != base_color);

        let kind = match text(raw, "type").to_ascii_lowercase().as_str() {
            "" | "bottle" | "bottled" => InkKind::Bottle,
            "sample" => InkKind::Sample,
            "cartridge" => InkKind::Cartridge,
            _ => InkKind::Other,
        };
        let volume_ml = self.number(raw, "volume_ml", &label).filter(|v| *v > 0.0);
        let amount = self
            .number(raw, "amount", &label)
            .map(|v| v.round().clamp(0.0, f64::from(u32::MAX)) as u32)
            .unwrap_or(1);
        let price = self.number(raw, "price", &label);
        let dry_time_seconds = self
            .number(raw, "dry_time", &label)
            .filter(|v| *v > 0.0)
            .map(|v| v.round().min(f64::from(u32::MAX)) as u32);

        let shading = self.level(raw, "shading", &label);
        let lubrication = self.level(raw, "lubrication", &label);
        let sheen = match key(raw, "sheen").as_str() {
            "" | "none" => Sheen::None,
            "low" => Sheen::Low,
            "medium" => Sheen::Medium,
            "high" => Sheen::High,
            "monster" => Sheen::Monster,
            other => self.unknown(&label, "sheen", other, Sheen::None),
        };
        let shimmer = match key(raw, "shimmer").as_str() {
            "" | "none" => Shimmer::None,
            "gold" => Shimmer::Gold,
            "silver" => Shimmer::Silver,
            "multiple" => Shimmer::Multiple,
            "other" => Shimmer::Other,
            other => self.unknown(&label, "shimmer", other, Shimmer::Other),
        };
        let flow = match key(raw, "flow").as_str() {
            "very dry" => Flow::VeryDry,
            "dry" => Flow::Dry,
            "" | "average" => Flow::Average,
            "wet" => Flow::Wet,
            "very wet" => Flow::VeryWet,
            other => self.unknown(&label, "flow", other, Flow::Average),
        };
        let water_resistance = match key(raw, "permanence").as_str() {
            "" | "none" => WaterResistance::None,
            "water resistant" => WaterResistance::WaterResistant,
            "waterproof" => WaterResistance::Waterproof,
            "archival" => WaterResistance::Archival,
            other => self.unknown(&label, "water resistance", other, WaterResistance::None),
        };

        let mut base_types = Vec::new();
        for value in strings(raw, "base_type") {
            let parsed = match value.to_ascii_lowercase().as_str() {
                "dye" => Some(BaseType::Dye),
                "pigment" => Some(BaseType::Pigment),
                "iron gall" => Some(BaseType::IronGall),
                "shimmer" => Some(BaseType::Shimmer),
                "scented" => Some(BaseType::Scented),
                _ => None,
            };
            match parsed {
                Some(t) if !base_types.contains(&t) => base_types.push(t),
                Some(_) => {}
                None => self.warn(format!("{label}: unknown base type {value:?} dropped")),
            }
        }
        let mut paper = Vec::new();
        for value in strings(raw, "paper_compatibility") {
            let parsed = match value.to_ascii_lowercase().as_str() {
                "friendly" => Some(PaperBehavior::Friendly),
                "average" => Some(PaperBehavior::Average),
                "feathering" => Some(PaperBehavior::Feathering),
                "bleeding" => Some(PaperBehavior::Bleeding),
                "show through" | "show-through" => Some(PaperBehavior::ShowThrough),
                _ => None,
            };
            match parsed {
                Some(p) if !paper.contains(&p) => paper.push(p),
                Some(_) => {}
                None => self.warn(format!("{label}: unknown paper behavior {value:?} dropped")),
            }
        }

        // 2.x mirrored an ink's swatch photo into the ink's own `image` field.
        // The swatch keeps that photo, so the ink doesn't need a copy.
        let images = if text(raw, "image").starts_with("swatches/") {
            let mut without_alias = raw.clone();
            without_alias.remove("image");
            self.images(&without_alias, ImageSection::Inks, &label)
        } else {
            self.images(raw, ImageSection::Inks, &label)
        };
        let (created_at, updated_at) = times.span(&id, fallback);

        Some(Ink {
            id,
            brand,
            line: text(raw, "line"),
            name,
            kind,
            volume_ml,
            amount,
            price,
            base_color,
            sheen_color,
            color_family: None,
            shimmer,
            sheen,
            shading,
            water_resistance,
            flow,
            lubrication,
            dry_time_seconds,
            base_types,
            paper,
            notes: text(raw, "notes"),
            notes_public: false,
            images,
            created_at,
            updated_at,
        })
    }

    fn swatch(
        &mut self,
        raw: &Value,
        ink_ids: &HashSet<&str>,
        fallback: Timestamp,
    ) -> Option<Swatch> {
        let raw = raw.as_object()?;
        let ink_id = text(raw, "ink_id");
        if !ink_ids.contains(ink_id.as_str()) {
            self.warn(format!(
                "Skipped a swatch linked to a missing ink ({ink_id:?})"
            ));
            return None;
        }
        let id = self.id(raw, "swatch", "Swatch");
        let label = format!("Swatch {id}");
        let mut notes = text(raw, "swatch_notes");
        let date = text(raw, "swatch_date");
        let sampled_on = if date.is_empty() {
            None
        } else if crate::validate::is_iso_date(&date, false) {
            Some(date)
        } else {
            self.warn(format!("{label}: date {date:?} kept in notes"));
            if !notes.is_empty() {
                notes.push('\n');
            }
            notes.push_str(&format!("Sampled: {date}"));
            None
        };
        let images = self.images(raw, ImageSection::Swatches, &label);
        let created_at = raw
            .get("created_at")
            .and_then(Value::as_i64)
            .filter(|t| *t > 0)
            .unwrap_or(fallback);

        Some(Swatch {
            id,
            ink_id,
            paper: text(raw, "swatch_paper"),
            nib: text(raw, "swatch_nib"),
            sampled_on,
            notes,
            notes_public: false,
            images,
            created_at,
            updated_at: created_at,
        })
    }

    fn images(
        &mut self,
        raw: &Map<String, Value>,
        section: ImageSection,
        label: &str,
    ) -> Vec<Image> {
        let mut entries: Vec<(String, bool, i64)> = Vec::new();
        for entry in array(raw, "images") {
            match entry {
                Value::String(path) => entries.push((path.clone(), false, 0)),
                Value::Object(obj) => entries.push((
                    text(obj, "path"),
                    obj.get("primary").and_then(Value::as_bool).unwrap_or(false),
                    obj.get("rotation").and_then(Value::as_i64).unwrap_or(0),
                )),
                _ => {}
            }
        }
        // Older items kept a single photo in `image`.
        let legacy = text(raw, "image");
        if !legacy.is_empty() && !legacy.contains("default_") {
            let rotation = raw
                .get("image_rotation")
                .and_then(Value::as_i64)
                .unwrap_or(0);
            entries.push((legacy, false, rotation));
        }

        let mut images: Vec<Image> = Vec::new();
        for (path, primary, rotation) in entries {
            let path = path.strip_prefix("images/").unwrap_or(&path).to_string();
            if images.iter().any(|image| image.path == path) {
                continue;
            }
            if !is_managed_image_path(&path, section) {
                self.warn(format!(
                    "{label}: photo path {path:?} is not usable; dropped"
                ));
                continue;
            }
            if !(self.image_exists)(&path) {
                self.warn(format!("{label}: photo {path:?} is missing; dropped"));
                continue;
            }
            let mut image = Image::new(new_id("img"), path);
            image.primary = primary;
            image.rotation = (((rotation.rem_euclid(360) + 45) / 90 * 90) % 360) as u16;
            images.push(image);
        }
        if let Some(first_primary) = images.iter().position(|image| image.primary) {
            for (n, image) in images.iter_mut().enumerate() {
                image.primary = n == first_primary;
            }
        } else if let Some(first) = images.first_mut() {
            first.primary = true;
        }
        for image in &images {
            if !self.images.contains(&image.path) {
                self.images.push(image.path.clone());
            }
        }
        images
    }

    fn number(&mut self, raw: &Map<String, Value>, field: &str, label: &str) -> Option<f64> {
        match raw.get(field) {
            None | Some(Value::Null) => None,
            Some(Value::Number(n)) => n.as_f64().filter(|v| v.is_finite() && *v >= 0.0),
            Some(Value::String(s)) => {
                let cleaned: String = s
                    .trim()
                    .replace(',', ".")
                    .chars()
                    .filter(|c| c.is_ascii_digit() || *c == '.')
                    .collect();
                if s.trim().is_empty() {
                    None
                } else if let Some(v) = cleaned.parse::<f64>().ok().filter(|v| v.is_finite()) {
                    Some(v)
                } else {
                    self.warn(format!("{label}: {field} {s:?} is not a number; dropped"));
                    None
                }
            }
            Some(other) => {
                self.warn(format!("{label}: {field} {other} is not a number; dropped"));
                None
            }
        }
    }

    fn level(&mut self, raw: &Map<String, Value>, field: &str, label: &str) -> Level {
        match key(raw, field).as_str() {
            "" | "none" => Level::None,
            "low" => Level::Low,
            "medium" => Level::Medium,
            "high" => Level::High,
            other => self.unknown(label, field, other, Level::None),
        }
    }

    fn unknown<T: std::fmt::Debug>(
        &mut self,
        label: &str,
        field: &str,
        value: &str,
        default: T,
    ) -> T {
        self.warn(format!(
            "{label}: unknown {field} {value:?}; set to {default:?}"
        ));
        default
    }

    /// Rebuilds fills from inking events in the activity log, then lines them
    /// up with the pens that are inked right now.
    fn fills(
        &mut self,
        activity: &[Value],
        currently_inked: &[Value],
        pen_ids: &HashSet<&str>,
        ink_ids: &HashSet<&str>,
    ) -> Vec<Fill> {
        struct Event<'a> {
            at: Timestamp,
            pen: &'a str,
            action: &'a str,
            ink: Option<&'a str>,
        }
        let mut events: Vec<Event> = activity
            .iter()
            .filter_map(Value::as_object)
            .filter(|e| e.get("category").and_then(Value::as_str) == Some("pen"))
            .filter_map(|e| {
                let action = e.get("action")?.as_str()?;
                if !matches!(action, "inked" | "reinked" | "cleaned") {
                    return None;
                }
                Some(Event {
                    at: e.get("timestamp")?.as_i64().filter(|t| *t > 0)?,
                    pen: e.get("entity_id")?.as_str()?,
                    action,
                    ink: e
                        .get("metadata")
                        .and_then(|m| m.get("new_ink_id"))
                        .and_then(Value::as_str),
                })
            })
            .collect();
        events.sort_by_key(|e| e.at);

        let mut fills: Vec<Fill> = Vec::new();
        let mut open: HashMap<&str, usize> = HashMap::new();
        for event in &events {
            if let Some(index) = open.remove(event.pen) {
                fills[index].emptied_at = Some(event.at);
            }
            if event.action != "cleaned" {
                if let Some(ink) = event.ink.filter(|ink| !ink.is_empty()) {
                    open.insert(event.pen, fills.len());
                    fills.push(Fill {
                        id: new_id("fill"),
                        pen_id: event.pen.to_string(),
                        ink_id: ink.to_string(),
                        inked_at: event.at,
                        emptied_at: None,
                        note: String::new(),
                    });
                }
            }
        }

        // The list of inked pens is the source of truth for what is in each pen now.
        let mut current: HashMap<String, (String, Timestamp)> = HashMap::new();
        for entry in currently_inked.iter().filter_map(Value::as_object) {
            let pen = text(entry, "pen_id");
            let ink = text(entry, "ink_id");
            let at = entry.get("date_inked").and_then(Value::as_i64).unwrap_or(0);
            if !pen.is_empty() && !ink.is_empty() && at > 0 {
                current.insert(pen, (ink, at));
            }
        }
        let mut closed_without_event = 0;
        for (pen, index) in open {
            match current.get(pen) {
                Some((ink, at)) if *ink == fills[index].ink_id => {
                    // 2.x kept the first inking date when a pen was re-inked, so
                    // the logged event is more precise when it is later.
                    fills[index].inked_at = fills[index].inked_at.max(*at);
                }
                Some((_, at)) => {
                    // The pen now holds a different ink; the switch wasn't logged.
                    let start = fills[index].inked_at;
                    fills[index].emptied_at = Some((*at).max(start));
                }
                None => {
                    // Logged as inked but empty now: the flush wasn't logged.
                    // End it where it started; its true end is unknown.
                    fills[index].emptied_at = Some(fills[index].inked_at);
                    closed_without_event += 1;
                }
            }
        }
        for (pen, (ink, at)) in &current {
            let already_open = fills
                .iter()
                .any(|f| f.pen_id == *pen && f.emptied_at.is_none());
            if !already_open {
                // Start no earlier than the pen's last logged change, so the
                // current fill stays the latest one.
                let last_logged = events
                    .iter()
                    .filter(|e| e.pen == pen)
                    .map(|e| e.at)
                    .max()
                    .unwrap_or(*at);
                fills.push(Fill {
                    id: new_id("fill"),
                    pen_id: pen.clone(),
                    ink_id: ink.clone(),
                    inked_at: (*at).max(last_logged),
                    emptied_at: None,
                    note: String::new(),
                });
            }
        }
        if closed_without_event > 0 {
            self.warn(format!(
                "{closed_without_event} past fill(s) had no recorded flush; their end date is unknown"
            ));
        }

        let before = fills.len();
        fills
            .retain(|f| pen_ids.contains(f.pen_id.as_str()) && ink_ids.contains(f.ink_id.as_str()));
        if fills.len() < before {
            self.warn(format!(
                "{} fill(s) referred to a deleted pen or ink and were dropped",
                before - fills.len()
            ));
        }

        // A pen holds one ink at a time: trim overlaps so each fill ends no later
        // than the next one starts, and only the latest stays open.
        fills.sort_by(|a, b| a.pen_id.cmp(&b.pen_id).then(a.inked_at.cmp(&b.inked_at)));
        for n in 1..fills.len() {
            if fills[n].pen_id == fills[n - 1].pen_id {
                let next_start = fills[n].inked_at;
                let previous = &mut fills[n - 1];
                if previous.emptied_at.is_none_or(|end| end > next_start) {
                    previous.emptied_at = Some(next_start.max(previous.inked_at));
                }
            }
        }
        fills.sort_by_key(|f| f.inked_at);
        fills
    }

    fn activity(&mut self, activity: &[Value], pens: &[Pen], inks: &[Ink]) -> Vec<ActivityEntry> {
        let pen_names: HashMap<&str, String> = pens
            .iter()
            .map(|p| (p.id.as_str(), display_name(&[&p.brand, &p.model], "Pen")))
            .collect();
        let ink_names: HashMap<&str, String> = inks
            .iter()
            .map(|i| (i.id.as_str(), display_name(&[&i.brand, &i.name], "Ink")))
            .collect();

        let mut skipped = 0;
        let mut out = Vec::new();
        for entry in activity.iter().filter_map(Value::as_object) {
            let subject = match key(entry, "category").as_str() {
                "pen" => Subject::Pen,
                "ink" => Subject::Ink,
                "swatch" => Subject::Swatch,
                _ => {
                    skipped += 1;
                    continue;
                }
            };
            let action = match key(entry, "action").as_str() {
                "created" => Action::Created,
                "updated" => Action::Updated,
                "deleted" => Action::Deleted,
                "inked" => Action::Inked,
                "reinked" => Action::Reinked,
                "cleaned" => Action::Flushed,
                _ => {
                    skipped += 1;
                    continue;
                }
            };
            let Some(at) = entry
                .get("timestamp")
                .and_then(Value::as_i64)
                .filter(|t| *t > 0)
            else {
                skipped += 1;
                continue;
            };
            let subject_id = text(entry, "entity_id");
            let meta = entry.get("metadata").and_then(Value::as_object);
            let meta_text = |field: &str| meta.map(|m| text(m, field)).unwrap_or_default();
            let meta_id = |field: &str| Some(meta_text(field)).filter(|s| !s.is_empty());

            let recorded_name = match subject {
                Subject::Pen => meta_text("pen_display_name"),
                Subject::Ink => meta_text("ink_display_name"),
                Subject::Swatch => meta_text("swatch_ink_display_name"),
            };
            let label = if !recorded_name.is_empty() {
                recorded_name
            } else {
                match subject {
                    Subject::Pen => pen_names.get(subject_id.as_str()).cloned(),
                    Subject::Ink => ink_names.get(subject_id.as_str()).cloned(),
                    Subject::Swatch => None,
                }
                .unwrap_or_default()
            };
            let inks_apply = matches!(action, Action::Inked | Action::Reinked | Action::Flushed);

            let id = {
                let old = text(entry, "id");
                if !old.is_empty() && self.seen_ids.insert(old.clone()) {
                    old
                } else {
                    new_id("act")
                }
            };
            out.push(ActivityEntry {
                id,
                at,
                subject,
                action,
                subject_id,
                label,
                previous_ink_id: if inks_apply {
                    meta_id("previous_ink_id")
                } else {
                    None
                },
                ink_id: if inks_apply {
                    meta_id("new_ink_id")
                } else {
                    None
                },
                changes: Vec::new(),
            });
        }
        if skipped > 0 {
            self.warn(format!(
                "{skipped} activity entr(ies) of unknown kind skipped"
            ));
        }
        out.sort_by_key(|e| e.at);
        out
    }
}

/// First and last time the activity log mentions each item.
struct EntityTimes(HashMap<String, (Timestamp, Timestamp)>);

impl EntityTimes {
    fn from_activity(activity: &[Value]) -> Self {
        let mut map: HashMap<String, (Timestamp, Timestamp)> = HashMap::new();
        for entry in activity.iter().filter_map(Value::as_object) {
            let id = text(entry, "entity_id");
            let Some(at) = entry
                .get("timestamp")
                .and_then(Value::as_i64)
                .filter(|t| *t > 0)
            else {
                continue;
            };
            if id.is_empty() {
                continue;
            }
            let span = map.entry(id).or_insert((at, at));
            span.0 = span.0.min(at);
            span.1 = span.1.max(at);
        }
        Self(map)
    }

    fn span(&self, id: &str, fallback: Timestamp) -> (Timestamp, Timestamp) {
        self.0.get(id).copied().unwrap_or((fallback, fallback))
    }
}

fn settings(prefs: &Map<String, Value>, _data: &Map<String, Value>) -> Settings {
    let obj = |field: &str| {
        prefs
            .get(field)
            .and_then(Value::as_object)
            .cloned()
            .unwrap_or_default()
    };
    let flag = |map: &Map<String, Value>, field: &str, default: bool| {
        map.get(field).and_then(Value::as_bool).unwrap_or(default)
    };
    let theme = |value: String| match value.as_str() {
        "light" => Theme::Light,
        "dark" => Theme::Dark,
        _ => Theme::Auto,
    };

    let filters = obj("activity_log_filters");
    let defaults = obj("defaults");
    let backup = obj("backup");
    let import_export = obj("import_export");
    let showcase = obj("showcase");
    let sort = showcase
        .get("default_sort")
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();

    let base = Settings::default();
    Settings {
        theme: theme(key(prefs, "color_mode")),
        open_items_in_edit_mode: flag(
            prefs,
            "open_cards_in_edit_mode",
            base.open_items_in_edit_mode,
        ),
        confirm_destructive_actions: flag(prefs, "confirm_destructive_actions", true),
        activity: ActivitySettings {
            retention: match prefs.get("activity_retention_days").and_then(Value::as_u64) {
                Some(days @ 1..) => Retention::Days(days.min(u64::from(u32::MAX)) as u32),
                _ => Retention::Forever,
            },
            detail: match key(prefs, "activity_log_verbosity").as_str() {
                "minimal" => ActivityDetail::Brief,
                "detailed" => ActivityDetail::Detailed,
                _ => ActivityDetail::Normal,
            },
            record_pen_changes: flag(&filters, "pen_edits", true),
            record_ink_changes: flag(&filters, "ink_edits", true),
            record_swatches: flag(&filters, "swatches", true),
            record_deletions: flag(&filters, "deletes", true),
        },
        defaults: Defaults {
            currency: Some(text(&defaults, "currency").to_ascii_uppercase())
                .filter(|c| c.len() == 3 && c.bytes().all(|b| b.is_ascii_uppercase()))
                .unwrap_or(base.defaults.currency),
            date_format: match key(&defaults, "date_format").as_str() {
                "us" => DateFormat::Us,
                "eu" => DateFormat::Eu,
                "iso" => DateFormat::Iso,
                _ => DateFormat::System,
            },
            nib_size: text(&defaults, "pen_nib"),
            nib_material: text(&defaults, "pen_nib_material"),
            ink_kind: match key(&defaults, "ink_type").as_str() {
                "sample" => InkKind::Sample,
                "cartridge" => InkKind::Cartridge,
                "other" => InkKind::Other,
                _ => InkKind::Bottle,
            },
        },
        backups: BackupSettings {
            frequency: match key(&backup, "auto_frequency").as_str() {
                "off" => BackupFrequency::Off,
                "weekly" => BackupFrequency::Weekly,
                "monthly" => BackupFrequency::Monthly,
                _ => BackupFrequency::Daily,
            },
            keep: backup
                .get("retention_count")
                .and_then(Value::as_f64)
                .map(|n| n.round().clamp(1.0, f64::from(BackupSettings::MAX_KEEP)) as u32)
                .unwrap_or(base.backups.keep),
            keep_replaced_photos: flag(&backup, "keep_replaced_images", false),
            validate_on_import: flag(&import_export, "auto_validate_import", true),
        },
        showcase: ShowcaseSettings {
            // 2.x had no switch; 3.0 starts private and the owner opens it.
            enabled: false,
            title: Some(text(&showcase, "title"))
                .filter(|t| !t.trim().is_empty())
                .unwrap_or(base.showcase.title),
            theme: theme(key(&showcase, "color_mode")),
            show_pens: flag(&showcase, "show_pens", true),
            show_inks: flag(&showcase, "show_inks", true),
            show_swatches: flag(&showcase, "show_swatches", true),
            show_prices: flag(&showcase, "show_prices", false),
            show_purchase_dates: false,
            show_purchased_from: false,
            // 2.x showed every note; 3.0 starts private and lets the owner choose.
            show_notes: false,
            show_stats: flag(&showcase, "show_insights", true),
            show_charts: flag(&showcase, "show_charts", true),
            show_activity: flag(prefs, "show_activity_log", true),
            show_activity_filters: flag(&showcase, "show_activity_filters", true),
            show_recent_activity: flag(prefs, "show_recent_activity", true),
            pen_sort: match key(&sort, "pens").as_str() {
                "oldest" => PenSort::Oldest,
                "brand-asc" | "brand-desc" => PenSort::Brand,
                "model-asc" | "model-desc" => PenSort::Model,
                _ => PenSort::Newest,
            },
            ink_sort: match key(&sort, "inks").as_str() {
                "newest" => InkSort::Newest,
                "oldest" => InkSort::Oldest,
                "brand-asc" | "brand-desc" => InkSort::Brand,
                "name-asc" | "name-desc" => InkSort::Name,
                _ => InkSort::Hue,
            },
            swatch_sort: match key(&sort, "swatches").as_str() {
                "oldest" => SwatchSort::Oldest,
                "brand-asc" | "brand-desc" | "name-asc" | "name-desc" => SwatchSort::Ink,
                _ => SwatchSort::Newest,
            },
        },
        stats: StatsSettings::default(),
        check_for_updates: base.check_for_updates,
    }
}

fn array<'a>(map: &'a Map<String, Value>, field: &str) -> &'a [Value] {
    map.get(field)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

/// A trimmed string field, or empty.
/// 2.x stored one text such as "Converter, Cartridge"; 3.0 keeps each on its own.
fn filling_systems(raw: &str) -> Vec<String> {
    let mut systems: Vec<String> = Vec::new();
    for part in raw
        .split([',', '/', '+'])
        .map(str::trim)
        .filter(|p| !p.is_empty())
    {
        if !systems.iter().any(|s| s.eq_ignore_ascii_case(part)) {
            systems.push(part.to_string());
        }
    }
    systems
}

fn text(map: &Map<String, Value>, field: &str) -> String {
    map.get(field)
        .and_then(Value::as_str)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

/// A string field normalized for matching against known values.
fn key(map: &Map<String, Value>, field: &str) -> String {
    text(map, field).to_ascii_lowercase()
}

fn strings(map: &Map<String, Value>, field: &str) -> Vec<String> {
    array(map, field)
        .iter()
        .filter_map(Value::as_str)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn display_name(parts: &[&str], fallback: &str) -> String {
    let joined = parts
        .iter()
        .filter(|p| !p.is_empty())
        .copied()
        .collect::<Vec<_>>()
        .join(" ");
    if joined.is_empty() {
        fallback.to_string()
    } else {
        joined
    }
}

/// `#abc` or `#AABBCC` to `#aabbcc`; anything else to `None`.
pub fn normalize_hex(value: &str) -> Option<String> {
    let hex = value.trim().strip_prefix('#')?;
    if !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    let full = match hex.len() {
        3 => hex.chars().flat_map(|c| [c, c]).collect::<String>(),
        6 => hex.to_string(),
        _ => return None,
    };
    Some(format!("#{}", full.to_ascii_lowercase()))
}
