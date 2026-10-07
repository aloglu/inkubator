//! Rules a [`Collection`] must satisfy before it is stored.

use std::collections::{HashMap, HashSet};
use std::fmt;

use crate::images::{is_managed_image_path, ImageSection};
use crate::model::{Collection, Image, Retention, SCHEMA_VERSION};

/// One broken rule, located by a JSON-pointer-like path such as `pens[3].colors[0]`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Problem {
    pub path: String,
    pub message: String,
}

impl fmt::Display for Problem {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.path, self.message)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, thiserror::Error)]
#[error("the collection is invalid ({} problem(s)): {}", .0.len(), first_problem(.0))]
pub struct ValidationError(pub Vec<Problem>);

fn first_problem(problems: &[Problem]) -> String {
    problems
        .first()
        .map(ToString::to_string)
        .unwrap_or_default()
}

pub fn validate(collection: &Collection) -> Result<(), ValidationError> {
    let mut check = Checker::default();
    check.collection(collection);
    if check.problems.is_empty() {
        Ok(())
    } else {
        Err(ValidationError(check.problems))
    }
}

/// True for `#rrggbb` in lowercase.
pub fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// True for `YYYY-MM-DD`, or also `YYYY-MM` when `allow_month` is set.
pub fn is_iso_date(value: &str, allow_month: bool) -> bool {
    let parts: Vec<&str> = value.split('-').collect();
    let number = |part: &str, len: usize, min: u32, max: u32| {
        part.len() == len
            && part.bytes().all(|b| b.is_ascii_digit())
            && part.parse::<u32>().is_ok_and(|n| (min..=max).contains(&n))
    };
    match parts.as_slice() {
        [year, month] if allow_month => number(year, 4, 1000, 9999) && number(month, 2, 1, 12),
        [year, month, day] => {
            number(year, 4, 1000, 9999) && number(month, 2, 1, 12) && number(day, 2, 1, 31)
        }
        _ => false,
    }
}

#[derive(Default)]
struct Checker {
    problems: Vec<Problem>,
}

impl Checker {
    fn fail(&mut self, path: impl Into<String>, message: impl Into<String>) {
        self.problems.push(Problem {
            path: path.into(),
            message: message.into(),
        });
    }

    fn collection(&mut self, c: &Collection) {
        if c.schema_version != SCHEMA_VERSION {
            self.fail(
                "schema_version",
                format!("expected {SCHEMA_VERSION}, found {}", c.schema_version),
            );
        }

        let pen_ids = self.unique_ids("pens", c.pens.iter().map(|p| p.id.as_str()));
        let ink_ids = self.unique_ids("inks", c.inks.iter().map(|i| i.id.as_str()));
        self.unique_ids("swatches", c.swatches.iter().map(|s| s.id.as_str()));
        self.unique_ids("fills", c.fills.iter().map(|f| f.id.as_str()));
        self.unique_ids("activity", c.activity.iter().map(|a| a.id.as_str()));

        for (n, pen) in c.pens.iter().enumerate() {
            let at = format!("pens[{n}]");
            if pen.brand.trim().is_empty() && pen.model.trim().is_empty() {
                self.fail(&at, "a pen needs a brand or a model");
            }
            for (k, color) in pen.colors.iter().enumerate() {
                if !is_hex_color(color) {
                    self.fail(format!("{at}.colors[{k}]"), "must be a #rrggbb color");
                }
            }
            self.money(&format!("{at}.price"), pen.price);
            if let Some(date) = &pen.purchased_on {
                if !is_iso_date(date, true) {
                    self.fail(
                        format!("{at}.purchased_on"),
                        "must be YYYY-MM-DD or YYYY-MM",
                    );
                }
            }
            self.timestamps(&at, pen.created_at, pen.updated_at);
            self.images(&at, ImageSection::Pens, &pen.images);
        }

        for (n, ink) in c.inks.iter().enumerate() {
            let at = format!("inks[{n}]");
            if ink.name.trim().is_empty() {
                self.fail(&at, "an ink needs a name");
            }
            if !is_hex_color(&ink.base_color) {
                self.fail(format!("{at}.base_color"), "must be a #rrggbb color");
            }
            if let Some(sheen) = &ink.sheen_color {
                if !is_hex_color(sheen) {
                    self.fail(format!("{at}.sheen_color"), "must be a #rrggbb color");
                }
            }
            if let Some(volume) = ink.volume_ml {
                if !(volume.is_finite() && volume > 0.0) {
                    self.fail(format!("{at}.volume_ml"), "must be a positive number");
                }
            }
            self.money(&format!("{at}.price"), ink.price);
            if has_duplicates(&ink.base_types) {
                self.fail(format!("{at}.base_types"), "lists a value twice");
            }
            if has_duplicates(&ink.paper) {
                self.fail(format!("{at}.paper"), "lists a value twice");
            }
            self.timestamps(&at, ink.created_at, ink.updated_at);
            self.images(&at, ImageSection::Inks, &ink.images);
        }

        for (n, swatch) in c.swatches.iter().enumerate() {
            let at = format!("swatches[{n}]");
            if !ink_ids.contains(swatch.ink_id.as_str()) {
                self.fail(
                    format!("{at}.ink_id"),
                    "refers to an ink that does not exist",
                );
            }
            if let Some(date) = &swatch.sampled_on {
                if !is_iso_date(date, false) {
                    self.fail(format!("{at}.sampled_on"), "must be YYYY-MM-DD");
                }
            }
            self.timestamps(&at, swatch.created_at, swatch.updated_at);
            self.images(&at, ImageSection::Swatches, &swatch.images);
        }

        self.fills(c, &pen_ids, &ink_ids);

        for (n, entry) in c.activity.iter().enumerate() {
            if entry.at <= 0 {
                self.fail(format!("activity[{n}].at"), "must be a positive timestamp");
            }
        }

        self.settings(c);
    }

    fn unique_ids<'a>(
        &mut self,
        list: &str,
        ids: impl Iterator<Item = &'a str>,
    ) -> HashSet<&'a str> {
        let mut seen = HashSet::new();
        for (n, id) in ids.enumerate() {
            if id.trim().is_empty() {
                self.fail(format!("{list}[{n}].id"), "must not be empty");
            } else if !seen.insert(id) {
                self.fail(format!("{list}[{n}].id"), format!("duplicate id {id:?}"));
            }
        }
        seen
    }

    fn money(&mut self, path: &str, value: Option<f64>) {
        if let Some(value) = value {
            if !(value.is_finite() && value >= 0.0) {
                self.fail(path, "must be zero or more");
            }
        }
    }

    fn timestamps(&mut self, at: &str, created: i64, updated: i64) {
        if created <= 0 {
            self.fail(format!("{at}.created_at"), "must be a positive timestamp");
        }
        if updated < created {
            self.fail(format!("{at}.updated_at"), "is earlier than created_at");
        }
    }

    fn images(&mut self, at: &str, section: ImageSection, images: &[Image]) {
        let mut ids = HashSet::new();
        let mut paths = HashSet::new();
        for (k, image) in images.iter().enumerate() {
            let path = format!("{at}.images[{k}]");
            if image.id.trim().is_empty() || !ids.insert(image.id.as_str()) {
                self.fail(format!("{path}.id"), "must be present and unique");
            }
            if !is_managed_image_path(&image.path, section) {
                self.fail(
                    format!("{path}.path"),
                    format!("must be a photo inside {}/", section.dir()),
                );
            } else if !paths.insert(image.path.as_str()) {
                self.fail(format!("{path}.path"), "is attached twice");
            }
            if ![0, 90, 180, 270].contains(&image.rotation) {
                self.fail(format!("{path}.rotation"), "must be 0, 90, 180 or 270");
            }
            for (name, value) in [("focus_x", image.focus_x), ("focus_y", image.focus_y)] {
                if !(0.0..=1.0).contains(&value) {
                    self.fail(format!("{path}.{name}"), "must be between 0 and 1");
                }
            }
            if !(1.0..=Image::MAX_ZOOM).contains(&image.zoom) {
                self.fail(
                    format!("{path}.zoom"),
                    format!("must be between 1 and {}", Image::MAX_ZOOM),
                );
            }
        }
        let primaries = images.iter().filter(|image| image.primary).count();
        if !images.is_empty() && primaries != 1 {
            self.fail(
                format!("{at}.images"),
                format!("must have exactly one primary photo, found {primaries}"),
            );
        }
    }

    fn fills(&mut self, c: &Collection, pen_ids: &HashSet<&str>, ink_ids: &HashSet<&str>) {
        let mut by_pen: HashMap<&str, Vec<(usize, &crate::model::Fill)>> = HashMap::new();
        for (n, fill) in c.fills.iter().enumerate() {
            let at = format!("fills[{n}]");
            if !pen_ids.contains(fill.pen_id.as_str()) {
                self.fail(
                    format!("{at}.pen_id"),
                    "refers to a pen that does not exist",
                );
            }
            if !ink_ids.contains(fill.ink_id.as_str()) {
                self.fail(
                    format!("{at}.ink_id"),
                    "refers to an ink that does not exist",
                );
            }
            if fill.inked_at <= 0 {
                self.fail(format!("{at}.inked_at"), "must be a positive timestamp");
            }
            if let Some(emptied) = fill.emptied_at {
                if emptied < fill.inked_at {
                    self.fail(format!("{at}.emptied_at"), "is earlier than inked_at");
                }
            }
            by_pen
                .entry(fill.pen_id.as_str())
                .or_default()
                .push((n, fill));
        }

        // A pen holds one ink at a time: its fills must not overlap, and only the
        // latest may still be open.
        for fills in by_pen.values_mut() {
            fills.sort_by_key(|(_, fill)| fill.inked_at);
            for pair in fills.windows(2) {
                let (_, earlier) = pair[0];
                let (n, later) = pair[1];
                match earlier.emptied_at {
                    None => self.fail(
                        format!("fills[{n}]"),
                        "starts while an earlier fill of the same pen is still open",
                    ),
                    Some(emptied) if emptied > later.inked_at => self.fail(
                        format!("fills[{n}]"),
                        "overlaps an earlier fill of the same pen",
                    ),
                    Some(_) => {}
                }
            }
        }
    }

    fn settings(&mut self, c: &Collection) {
        let s = &c.settings;
        if let Retention::Days(days) = s.activity.retention {
            if days == 0 {
                self.fail("settings.activity.retention", "must keep at least one day");
            }
        }
        let currency = &s.defaults.currency;
        if currency.len() != 3 || !currency.bytes().all(|b| b.is_ascii_uppercase()) {
            self.fail(
                "settings.defaults.currency",
                "must be a three-letter code such as USD",
            );
        }
        if !(1..=crate::model::BackupSettings::MAX_KEEP).contains(&s.backups.keep) {
            self.fail("settings.backups.keep", "must be between 1 and 365");
        }
        if s.showcase.title.trim().is_empty() {
            self.fail("settings.showcase.title", "must not be empty");
        }
    }
}

fn has_duplicates<T: Eq + std::hash::Hash>(values: &[T]) -> bool {
    let mut seen = HashSet::new();
    values.iter().any(|value| !seen.insert(value))
}
